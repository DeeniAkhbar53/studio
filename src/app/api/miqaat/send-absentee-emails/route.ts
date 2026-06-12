import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendEmail, miqaatAbsenceEmailTemplate } from '@/lib/email';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { miqaatId, adminMohallahId, targetItsIds } = await req.json();

    if (!miqaatId) {
      return NextResponse.json({ error: 'Missing miqaatId.' }, { status: 400 });
    }

    // 1. Fetch Miqaat details
    const miqaatDocRef = doc(db, getYearPath('miqaats'), miqaatId);
    const miqaatDoc = await getDoc(miqaatDocRef);
    if (!miqaatDoc.exists()) {
      return NextResponse.json({ error: 'Miqaat not found.' }, { status: 404 });
    }
    const miqaatData = miqaatDoc.data();

    // Verify it is expired/closed (endTime in the past)
    const isExpired = new Date(miqaatData.endTime) < new Date();
    if (!isExpired) {
      return NextResponse.json({ error: 'This Miqaat is still active. Absentee emails can only be sent after the event is closed.' }, { status: 400 });
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

    // 4. Calculate Absentees
    // An absentee is an eligible user who is NOT in attendance AND NOT in safarList
    const attendedItsIds = new Set<string>([
      ...(miqaatData.attendance || []).map((a: any) => a.userItsId),
      ...(miqaatData.safarList || []).map((s: any) => s.userItsId)
    ]);

    const absentUsers = eligibleUsers.filter(user => !attendedItsIds.has(user.itsId));

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
              `Absence Notification: ${miqaatData.name}`,
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
