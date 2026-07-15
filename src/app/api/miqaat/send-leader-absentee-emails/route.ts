import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc, collection } from 'firebase/firestore';
import { sendEmail, teamLeaderAbsenceReportEmailTemplate, leaderStatsReportEmailTemplate } from '@/lib/email';
import { formatKuwaitDate } from '@/lib/kuwait-time';

export async function POST(req: NextRequest) {
  try {
    const { miqaatId, adminMohallahId, force, getRecipientsOnly, targetItsIds, sessionId } = await req.json();

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

    // 2. Fetch all Mohallahs to get names
    const mohallahsSnap = await getDocs(collection(db, 'mohallahs'));
    const mohallahNamesMap = new Map<string, string>();
    mohallahsSnap.forEach(docSnap => {
      mohallahNamesMap.set(docSnap.id, docSnap.data().name || docSnap.id);
    });

    // 3. Fetch all members
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
        role: data.role,
        mohallahId: docSnap.ref.parent.parent?.id, // Mohallah ID is parent of members subcollection
      };
    });

    // 4. Determine eligibility
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

    // 5. Determine active Mohallah IDs for this Miqaat
    const activeMohallahIds = new Set<string>();
    if (miqaatData.mohallahIds && miqaatData.mohallahIds.length > 0) {
      miqaatData.mohallahIds.forEach((id: string) => activeMohallahIds.add(id));
    } else if (isSpecificMemberMiqaat) {
      eligibleUsers.forEach(user => {
        if (user.mohallahId) activeMohallahIds.add(user.mohallahId);
      });
    } else if (adminMohallahId) {
      activeMohallahIds.add(adminMohallahId);
    }

    const isMohallahActive = (mohallahId: string | undefined) => {
      if (!mohallahId) return false;
      if (activeMohallahIds.size > 0) {
        return activeMohallahIds.has(mohallahId);
      }
      return true; // Active for all if no specific mohallahs defined
    };

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

    const isPresent = (itsId: string) => hasMarkedStatusForScope(miqaatData.attendance || [], itsId);
    const isSafar = (itsId: string) => hasMarkedStatusForScope(miqaatData.safarList || [], itsId);

    // 6. Calculate Absentees & Attendance Sets
    const absentUsers = eligibleUsers.filter(user => !isPresent(user.itsId) && !isSafar(user.itsId));

    // 7. Find designated leaders and administrators from active Mohallahs
    const leaders = allMembers.filter(user => {
      if (!user.email) return false;
      if (!isMohallahActive(user.mohallahId)) return false;

      const isGL = user.designation === 'Group Leader' || user.designation === 'Asst.Grp Leader';
      const isVC = user.designation === 'Vice Captain';
      const isCaptOrAdmin = user.role === 'admin' || user.role === 'superadmin' || user.designation === 'Captain' || user.designation === 'Idara Admin';

      return isGL || isVC || isCaptOrAdmin;
    });

    if (getRecipientsOnly) {
      return NextResponse.json({
        success: true,
        recipients: leaders.map(l => ({
          itsId: l.itsId,
          name: l.name,
          email: l.email,
          designation: l.designation,
          role: l.role,
          team: l.team,
          managedTeams: l.managedTeams,
          mohallahId: l.mohallahId,
          mohallahName: mohallahNamesMap.get(l.mohallahId || '') || 'Unknown Mohallah'
        }))
      });
    }

    let targetLeaders = leaders;
    if (Array.isArray(targetItsIds) && targetItsIds.length > 0) {
      const targetSet = new Set(targetItsIds);
      targetLeaders = leaders.filter(l => targetSet.has(l.itsId));
    }

    // 8. Route emails based on leader scope
    let reportsSent = 0;
    const errors: string[] = [];
    const formattedDate = formatKuwaitDate(miqaatData.startTime);

    await Promise.all(
      targetLeaders.map(async (leader) => {
        try {
          const leaderMohallahName = mohallahNamesMap.get(leader.mohallahId || '') || 'Unknown Mohallah';
          const isGL = leader.designation === 'Group Leader' || leader.designation === 'Asst.Grp Leader';
          const isVC = leader.designation === 'Vice Captain';
          const isCaptOrAdmin = leader.role === 'admin' || leader.role === 'superadmin' || leader.designation === 'Captain' || leader.designation === 'Idara Admin';

          if (isCaptOrAdmin) {
            // Scope: Entire Mohallah
            const mohallahEligible = eligibleUsers.filter(u => u.mohallahId === leader.mohallahId);
            const presentCount = mohallahEligible.filter(u => isPresent(u.itsId)).length;
            const safarCount = mohallahEligible.filter(u => isSafar(u.itsId)).length;
            const absentCount = mohallahEligible.filter(u => !isPresent(u.itsId) && !isSafar(u.itsId)).length;

            const emailHtml = leaderStatsReportEmailTemplate(
              leader.name,
              leader.designation || 'Leader',
              leaderMohallahName,
              `${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              formattedDate,
              { present: presentCount, absent: absentCount, safar: safarCount, total: mohallahEligible.length }
            );

            await sendEmail(
              leader.email!,
              `Attendance Summary Report - ${leaderMohallahName}: ${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              emailHtml
            );
            reportsSent++;

          } else if (isVC) {
            // Scope: Managed Teams (fallback to single team if managedTeams is empty)
            const managedTeams = leader.managedTeams && leader.managedTeams.length > 0
              ? leader.managedTeams
              : (leader.team ? [leader.team] : []);

            if (managedTeams.length === 0) return;

            const managedTeamsSet = new Set(managedTeams);
            const viceCaptainEligible = eligibleUsers.filter(u => 
              u.mohallahId === leader.mohallahId && 
              u.team && 
              managedTeamsSet.has(u.team)
            );

            const presentCount = viceCaptainEligible.filter(u => isPresent(u.itsId)).length;
            const safarCount = viceCaptainEligible.filter(u => isSafar(u.itsId)).length;
            const absentCount = viceCaptainEligible.filter(u => !isPresent(u.itsId) && !isSafar(u.itsId)).length;

            const emailHtml = leaderStatsReportEmailTemplate(
              leader.name,
              leader.designation || 'Vice Captain',
              managedTeams.join(', '),
              `${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              formattedDate,
              { present: presentCount, absent: absentCount, safar: safarCount, total: viceCaptainEligible.length }
            );

            await sendEmail(
              leader.email!,
              `Team Attendance Summary: ${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              emailHtml
            );
            reportsSent++;

          } else if (isGL) {
            // Scope: Single Team detailed absentee list
            const leaderTeam = leader.team;
            if (!leaderTeam) return;

            const teamEligible = eligibleUsers.filter(u => u.team === leaderTeam && u.mohallahId === leader.mohallahId);
            if (teamEligible.length === 0) return;

            const teamAbsentees = absentUsers.filter(u => u.team === leaderTeam && u.mohallahId === leader.mohallahId);

            const emailHtml = teamLeaderAbsenceReportEmailTemplate(
              leader.name,
              leader.designation || 'Team Leader',
              leaderTeam,
              `${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              formattedDate,
              teamAbsentees
            );

            await sendEmail(
              leader.email!,
              `Team Absentee Report: ${miqaatData.name}${sessionLabel ? ` - ${sessionLabel}` : ''}`,
              emailHtml
            );
            reportsSent++;
          }
        } catch (err: any) {
          console.error(`Error sending leader report to ${leader.email}:`, err);
          errors.push(`${leader.name} (${leader.email}): ${err.message || err}`);
        }
      })
    );

    return NextResponse.json({
      success: true,
      totalLeadersChecked: targetLeaders.length,
      reportScope: sessionLabel || 'Miqaat',
      reportsSent,
      errorsCount: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error: any) {
    console.error('send-leader-absentee-emails error:', error);
    return NextResponse.json({ error: 'Failed to send leader absentee emails.' }, { status: 500 });
  }
}
