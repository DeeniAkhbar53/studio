// Auth utility service — used by both client components and API routes
import bcrypt from 'bcryptjs';
import { db } from './firebase';
import { doc, updateDoc, collectionGroup, query, where, getDocs } from 'firebase/firestore';
import type { User, UserDesignation } from '@/types';

// Designations that require password + OTP
const SECURE_DESIGNATIONS: UserDesignation[] = [
  'Group Leader',
  'Asst.Grp Leader',
  'Captain',
  'Vice Captain',
  'Major',
  'Commander',
  'Assistant Commander',
  'Idara Admin',
  'Senior Assistant Commander',
];

/**
 * Determines if a user requires the full Password + OTP login flow.
 * Regular Members and J.Members use ITS ID only.
 */
export function requiresPasswordAndOtp(user: User): boolean {
  if (user.role === 'admin' || user.role === 'superadmin' || user.role === 'attendance-marker') {
    return true;
  }
  if (user.designation && SECURE_DESIGNATIONS.includes(user.designation)) {
    return true;
  }
  return false;
}

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}

/**
 * Verifies a password. Supports both bcrypt hashes and legacy plain-text passwords.
 * If a legacy plain-text match is found, it silently upgrades to a bcrypt hash.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
  user?: User
): Promise<boolean> {
  // Check if stored is a bcrypt hash
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(plain, stored);
  }

  // Legacy plain-text comparison
  if (plain === stored) {
    // Silently upgrade to bcrypt if user info is provided
    if (user && user.id && user.mohallahId) {
      try {
        const hashed = await hashPassword(plain);
        const userDocRef = doc(db, 'mohallahs', user.mohallahId, 'members', user.id);
        await updateDoc(userDocRef, { password: hashed });
      } catch {
        // Non-blocking: upgrade failure doesn't prevent login
      }
    }
    return true;
  }

  return false;
}

/**
 * Sets or updates a user's password (hashed) in Firestore.
 */
export async function setUserPassword(user: User, newPassword: string): Promise<void> {
  if (!user.id || !user.mohallahId) {
    throw new Error('User ID and Mohallah ID are required to set password.');
  }
  const hashed = await hashPassword(newPassword);
  const userDocRef = doc(db, 'mohallahs', user.mohallahId, 'members', user.id);
  await updateDoc(userDocRef, { password: hashed });
}

/**
 * Generates a 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
