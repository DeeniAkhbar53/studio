import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { sendEmail, attendanceConfirmationEmailTemplate, attendanceEditedEmailTemplate } from '@/lib/email';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { userItsId, miqaatId, status, markedAt, sessionId, reason, isEdit } = await req.json();

    if (!userItsId || !miqaatId || !status || !markedAt) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 1. Fetch user by ITS ID
    const membersQuery = query(collectionGroup(db, 'members'), where('itsId', '==', userItsId));
    const membersSnap = await getDocs(membersQuery);
    if (membersSnap.empty) {
      return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
    }
    const memberDoc = membersSnap.docs[0];
    const memberData = memberDoc.data();
    const userEmail = memberData.email;

    if (!userEmail) {
      // If no email exists, return a soft success status rather than throwing an error
      return NextResponse.json({ success: false, warning: 'Member does not have an email address.' });
    }

    const activeYear = req.cookies.get('active_year')?.value || '1448H';

    // 2. Fetch Miqaat details
    const miqaatDocRef = doc(db, getYearPath('miqaats', activeYear), miqaatId);
    const miqaatDoc = await getDoc(miqaatDocRef);
    if (!miqaatDoc.exists()) {
      return NextResponse.json({ error: 'Miqaat not found.' }, { status: 404 });
    }
    const miqaatData = miqaatDoc.data();

    // Check if present emails should be sent
    if (!miqaatData.sendEmail) {
      return NextResponse.json({ success: true, message: 'Present email notifications are disabled for this Miqaat.' });
    }

    // 3. Resolve Session Name if applicable
    let sessionName = '';
    if (sessionId && miqaatData.sessions) {
      const session = miqaatData.sessions.find((s: any) => s.id === sessionId);
      if (session) {
        sessionName = session.name;
      }
    }

    const formattedDate = format(new Date(markedAt), "PP p");

    // 4. Send Confirmation / Edit Email
    const emailHtml = isEdit
      ? attendanceEditedEmailTemplate(
          memberData.name,
          userItsId,
          miqaatData.name,
          sessionName,
          status,
          formattedDate,
          miqaatData.location || '',
          reason
        )
      : attendanceConfirmationEmailTemplate(
          memberData.name,
          userItsId,
          miqaatData.name,
          sessionName,
          status,
          formattedDate,
          miqaatData.location || '',
          reason
        );

    await sendEmail(
      userEmail,
      isEdit ? `Attendance Updated: ${miqaatData.name}` : `Attendance Marked: ${miqaatData.name}`,
      emailHtml
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('send-confirmation error:', error);
    return NextResponse.json({ error: 'Failed to send attendance email.' }, { status: 500 });
  }
}
