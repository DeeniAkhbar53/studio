import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendEmail, teamLeaderAbsenceReportEmailTemplate } from '@/lib/email';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { miqaatId, adminMohallahId, force } = await req.json();

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
    if (!isExpired && !force) {
      return NextResponse.json({ error: 'This Miqaat is still active. Leader reports can only be sent after the event is closed.' }, { status: 400 });
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
        managedTeams: data.managedTeams || [],
        designation: data.designation,
        mohallahId: docSnap.ref.parent.parent?.id, // Mohallah ID is parent of members subcollection
      };
    });

    // 3. Determine eligibility
    const isSpecificMemberMiqaat = miqaatData.eligibleItsIds && miqaatData.eligibleItsIds.length > 0;
    
    let eligibleUsers: any[];
    if (isSpecificMemberMiqaat) {
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
    const attendedItsIds = new Set<string>([
      ...(miqaatData.attendance || []).map((a: any) => a.userItsId),
      ...(miqaatData.safarList || []).map((s: any) => s.userItsId)
    ]);

    const absentUsers = eligibleUsers.filter(user => !attendedItsIds.has(user.itsId));

    // 5. Find Group Leaders and Assistant Group Leaders
    const leaders = allMembers.filter(user => 
      user.email && 
      (user.designation === 'Group Leader' || user.designation === 'Asst.Grp Leader') &&
      (!adminMohallahId || user.mohallahId === adminMohallahId)
    );

    // 6. Send absentee report to each leader
    let reportsSent = 0;
    const errors: string[] = [];
    const formattedDate = format(new Date(miqaatData.startTime), "PP");

    await Promise.all(
      leaders.map(async (leader) => {
        try {
          const leaderTeam = leader.team;
          if (!leaderTeam) return;

          // Find eligible team members
          const teamEligible = eligibleUsers.filter(u => u.team === leaderTeam);
          if (teamEligible.length === 0) return; // Skip if no members in this team are eligible for the miqaat

          // Find absentees of this leader's team
          const teamAbsentees = absentUsers.filter(u => u.team === leaderTeam);

          // We'll send the report to the leader
          const emailHtml = teamLeaderAbsenceReportEmailTemplate(
            leader.name,
            leader.designation || 'Team Leader',
            leaderTeam,
            miqaatData.name,
            formattedDate,
            teamAbsentees
          );

          await sendEmail(
            leader.email!,
            `Team Absentee Report: ${miqaatData.name}`,
            emailHtml
          );
          reportsSent++;
        } catch (err: any) {
          console.error(`Error sending leader report to ${leader.email}:`, err);
          errors.push(`${leader.name} (${leader.email}): ${err.message || err}`);
        }
      })
    );

    return NextResponse.json({
      success: true,
      totalLeadersChecked: leaders.length,
      reportsSent,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error: any) {
    console.error('send-leader-absentee-emails error:', error);
    return NextResponse.json({ error: 'Failed to send leader absentee emails.' }, { status: 500 });
  }
}
