import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { sendEmail, resetPasswordEmailTemplate } from '@/lib/email';
import { getUserByItsOrBgkId } from '@/lib/firebase/userService';
import { requiresPasswordAndOtp } from '@/lib/firebase/authService';
import { randomBytes } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { itsId } = await req.json();

    if (!itsId?.trim()) {
      return NextResponse.json({ error: 'ITS ID is required.' }, { status: 400 });
    }

    // Always return success message to prevent user enumeration
    const successResponse = NextResponse.json({
      success: true,
      message: 'If your ITS ID is registered with an email, a reset link has been sent.',
    });

    const user = await getUserByItsOrBgkId(itsId.trim());
    if (!user || !user.email) {
      return successResponse; // Don't reveal that user/email doesn't exist
    }

    // Do not send reset link for standard members / users who do not have password login enabled
    if (!requiresPasswordAndOtp(user)) {
      return successResponse;
    }

    // Generate a secure token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in Firestore
    await setDoc(doc(db, 'password_resets', token), {
      userItsId: user.itsId,
      userId: user.id,
      mohallahId: user.mohallahId,
      expiresAt: expiresAt.toISOString(),
      createdAt: serverTimestamp(),
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bgk-attendance.netlify.app';
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    await sendEmail(
      user.email,
      'Reset Your BGK Attendance Password',
      resetPasswordEmailTemplate(user.name, resetLink)
    );

    return successResponse;
  } catch (error: any) {
    console.error('send-reset-link error:', error);
    // Still return success to avoid leaking info
    return NextResponse.json({
      success: true,
      message: 'If your ITS ID is registered with an email, a reset link has been sent.',
    });
  }
}
