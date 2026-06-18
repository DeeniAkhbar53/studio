import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendEmail, miqaatAbsenceEmailTemplate } from '@/lib/email';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { miqaatId, adminMohallahId, targetItsIds, force, sessionId } = await req.json();

    if (!miqaatId) {
      return NextResponse.json({ error: 'Missing miqaatId.' }, { status: 400 });
    }

    const activeYear = req.cookies.get('active_year')?.value || '1448H';

    // 1. Fetch Miqaat details
    const miqaatDocRef = doc(db, getYearPath('miqaats', activeYear), miqaatId);
    const miqaatDoc = await getDoc(miqaatDocRef);
    if (!miqaatDoc.exists()) {
      return NextResponse.json({ error: 'Miqaat not found.' }, { status: 404 });
    }
    const miqaatData = miqaatDoc.data();

    // Verify it is expired/closed (endTime in the past)
    const isExpired = new Date(miqaatData.endTime) < new Date();
    const isSelective = targetItsIds && Array.isArray(targetItsIds) && targetItsIds.length > 0;
    if (!isExpired && !isSelective && !force) {
      return NextResponse.json({ error: 'This Miqaat is still active. Bulk absentee emails can only be sent after the event is closed.' }, { status: 400 });
    }

    // 2. Fetch all members
    const membersQuery = query(collectionGroup(db, 'members'));
    const membersSnap = await getDocs(membersQuery);
    const allMembers = membersSnap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        itsId: data.itsId,
        name: data.name,
        email: data.email,
        team: data.team,
        mohallahId: docSnap.ref.parent.parent?.id, // Mohallah ID is parent of members subcollection
      };
    });

    // 3. Determine eligibility
    const isSpecificMemberMiqaat = miqaatData.eligibleItsIds && miqaatData.eligibleItsIds.length > 0;
    
    let eligibleUsers: any[];
    if (targetItsIds && Array.isArray(targetItsIds)) {
      eligibleUsers = allMembers.filter(user => targetItsIds.includes(user.itsId));
      // Intersect with Miqaat eligibility
      if (isSpecificMemberMiqaat) {
        eligibleUsers = eligibleUsers.filter(user => miqaatData.eligibleItsIds!.includes(user.itsId));
      } else {
        if (miqaatData.mohallahIds && miqaatData.mohallahIds.length > 0) {
          eligibleUsers = eligibleUsers.filter(user => user.mohallahId && miqaatData.mohallahIds!.includes(user.mohallahId));
        }
        if (miqaatData.teams && miqaatData.teams.length > 0) {
          eligibleUsers = eligibleUsers.filter(user => user.team && miqaatData.teams!.includes(user.team));
        }
      }
    } else if (isSpecificMemberMiqaat) {
      eligibleUsers = allMembers.filter(user => miqaatData.eligibleItsIds!.includes(user.itsId));
    } else if (miqaatData.mohallahIds && miqaatData.mohallahIds.length > 0) {
      eligibleUsers = allMembers.filter(user => user.mohallahId && miqaatData.mohallahIds!.includes(user.mohallahId));
    } else if (miqaatData.teams && miqaatData.teams.length > 0) {
      eligibleUsers = allMembers.filter(user => user.team && miqaatData.teams!.includes(user.team));
    } else {
      if (adminMohallahId) {
        eligibleUsers = allMembers.filter(user => user.mohallahId === adminMohallahId);
      } else {
        eligibleUsers = allMembers; // Open to all
      }
    }

    const sessions = Array.isArray(miqaatData.sessions) ? miqaatData.sessions : [];
    const reportSessionIds = sessionId
      ? [sessionId]
      : (sessions.length > 0 ? sessions.map((session: any) => session.id).filter(Boolean) : [undefined]);
    const sessionLabel = sessionId
      ? sessions.find((session: any) => session.id === sessionId)?.name || 'Selected Session'
      : (sessions.length > 0 ? 'All Sessions' : '');

    const hasMarkedStatusForScope = (entries: any[], itsId: string) => {
      if (reportSessionIds.length === 0) return false;
      return reportSessionIds.some((reportSessionId) =>
        entries.some((entry: any) =>
          entry.userItsId === itsId &&
          (reportSessionId ? entry.sessionId === reportSessionId : true)
        )
      );
    };

    // 4. Calculate Absentees
    // For multi-session Miqaats, a member is counted as covered if they are present or safar in any report session.
    const absentUsers = eligibleUsers.filter(user =>
      !hasMarkedStatusForScope(miqaatData.attendance || [], user.itsId) &&
      !hasMarkedStatusForScope(miqaatData.safarList || [], user.itsId)
    );

    // 5. Send bulk emails in batches
    let emailsSent = 0;
    let emailsSkipped = 0;
    const errors: string[] = [];

    const absenteesWithEmail = absentUsers.filter(user => {
      if (user.email && user.email.trim() !== '') {
        return true;
      }
      emailsSkipped++;
      return false;
    });

    const formattedDate = format(new Date(miqaatData.startTime), "PP");
    const batchSize = 10;

    for (let i = 0; i < absenteesWithEmail.length; i += batchSize) {
      const chunk = absenteesWithEmail.slice(i, i + batchSize);
      await Promise.all(
        chunk.map(async (user) => {
          try {
            const emailHtml = miqaatAbsenceEmailTemplate(
              user.name,
              user.itsId,
              miqaatData.name,
              formattedDate,
              miqaatData.location || ''
            );
            await sendEmail(
              user.email!,
              `Absence Notification: ${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              emailHtml
            );
            emailsSent++;
          } catch (err: any) {
            console.error(`Error sending email to ${user.email}:`, err);
            errors.push(`${user.name} (${user.email}): ${err.message || err}`);
          }
        })
      );
    }

    return NextResponse.json({
      success: true,
      totalEligible: eligibleUsers.length,
      totalAbsent: absentUsers.length,
      reportScope: sessionLabel || 'Miqaat',
      emailsSent,
      emailsSkipped,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Send first 10 errors if any
    });
  } catch (error: any) {
    console.error('send-absentee-emails error:', error);
    return NextResponse.json({ error: 'Failed to send absentee emails.' }, { status: 500 });
  }
}
