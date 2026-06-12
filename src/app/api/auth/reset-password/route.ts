import { NextRequest, NextResponse } from 'next/server';
import { db, getYearPath } from '@/lib/firebase/firebase';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { hashPassword } from '@/lib/firebase/authService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
    }

    const resetDocRef = doc(db, 'password_resets', token);
    const resetDoc = await getDoc(resetDocRef);

    if (!resetDoc.exists()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has already been used.' },
        { status: 404 }
      );
    }

    const data = resetDoc.data();

    // Check expiry
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(resetDocRef);
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    return NextResponse.json({ success: true, message: 'Token is valid.' });
  } catch (error: any) {
    console.error('verify-token error:', error);
    return NextResponse.json({ error: 'Failed to verify token.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token and new password are required.' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const resetDocRef = doc(db, 'password_resets', token);
    const resetDoc = await getDoc(resetDocRef);

    if (!resetDoc.exists()) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has already been used.' },
        { status: 404 }
      );
    }

    const data = resetDoc.data();

    // Check expiry
    if (new Date() > new Date(data.expiresAt)) {
      await deleteDoc(resetDocRef);
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    const { userId, mohallahId } = data;
    if (!userId || !mohallahId) {
      return NextResponse.json({ error: 'Invalid reset token data.' }, { status: 400 });
    }

    // Hash and update password
    const hashed = await hashPassword(newPassword);
    const userDocRef = doc(db, getYearPath('mohallahs'), mohallahId, 'members', userId);
    await updateDoc(userDocRef, { password: hashed });

    // Delete the used token
    await deleteDoc(resetDocRef);

    return NextResponse.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error: any) {
    console.error('reset-password error:', error);
    return NextResponse.json({ error: 'Failed to reset password. Please try again.' }, { status: 500 });
  }
}
