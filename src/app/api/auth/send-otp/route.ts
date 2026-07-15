import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { sendEmail, otpEmailTemplate } from '@/lib/email';
import { generateOtp } from '@/lib/firebase/authService';

export async function POST(req: NextRequest) {
  try {
    const { userId, userItsId, userName, email, mohallahId } = await req.json();

    if (!userId || !userItsId || !email || !mohallahId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // Rate limiting: check if an OTP was sent in the last 60 seconds
    const otpDocRef = doc(db, 'otp_requests', userId);
    const existing = await getDoc(otpDocRef);
    if (existing.exists()) {
      const data = existing.data();
      const sentAt: Date = data.sentAt?.toDate?.() || new Date(0);
      const secondsSince = (Date.now() - sentAt.getTime()) / 1000;
      if (secondsSince < 60) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(60 - secondsSince)} seconds before requesting a new OTP.` },
          { status: 429 }
        );
      }
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in Firestore
    await setDoc(otpDocRef, {
      otp,
      expiresAt: expiresAt.toISOString(),
      userItsId,
      email,
      mohallahId,
      sentAt: serverTimestamp(),
    });

    // Send email
    await sendEmail(email, 'Your BGK Attendance Login OTP', otpEmailTemplate(userName, otp));

    return NextResponse.json({ success: true, maskedEmail: maskEmail(email) });
  } catch (error: any) {
    console.error('send-otp error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP. Please check your email address or contact admin.' },
      { status: 500 }
    );
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
}
