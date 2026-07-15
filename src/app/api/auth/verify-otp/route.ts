import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, otp } = await req.json();

    if (!userId || !otp) {
      return NextResponse.json({ error: 'Missing userId or OTP.' }, { status: 400 });
    }

    const otpDocRef = doc(db, 'otp_requests', userId);
    const otpDoc = await getDoc(otpDocRef);

    if (!otpDoc.exists()) {
      return NextResponse.json({ error: 'OTP not found. Please request a new one.' }, { status: 404 });
    }

    const data = otpDoc.data();

    // Check expiry
    const expiresAt = new Date(data.expiresAt);
    if (new Date() > expiresAt) {
      await deleteDoc(otpDocRef); // Clean up expired OTP
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 410 });
    }

    // Validate OTP
    if (data.otp !== otp.trim()) {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 401 });
    }

    // OTP verified — delete it so it can't be reused
    await deleteDoc(otpDocRef);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('verify-otp error:', error);
    return NextResponse.json({ error: 'OTP verification failed.' }, { status: 500 });
  }
}
