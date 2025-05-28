
export type UserRole = 'user' | 'admin' | 'superadmin' | 'attendance-marker';
export type UserDesignation = 'Captain' | 'Vice Captain' | 'Member';

export type User = {
  id: string;
  itsId: string;
  bgkId?: string;
  name: string;
  team?: string;
  phoneNumber?: string;
  mohallahId?: string;
  role: UserRole;
  avatarUrl?: string;
  designation?: UserDesignation;
};

export type Miqaat = {
  id: string;
  name: string;
  startTime: string; // ISO Date string from datetime-local input
  endTime: string; // ISO Date string from datetime-local input
  teams: string[];
  barcodeData?: string;
  location?: string;
  createdAt?: string; // ISO Date string, from serverTimestamp after conversion
};

export type AttendanceRecord = {
  id: string; // Firestore document ID
  miqaatId: string;
  miqaatName: string; // Denormalized for easier display
  userItsId: string;
  userName: string; // Denormalized for easier display
  markedAt: string; // ISO Date string of the timestamp when marked
  markedByItsId?: string; // Optional: ITS ID of the person who marked attendance
  // status field is not stored in DB for direct attendance, it's context-dependent (e.g., "Present")
};

export type Team = {
  id: string;
  name: string;
  members: User[];
  leader?: User;
};

// Represents a Mohallah entity as stored in Firestore
export type Mohallah = {
  id: string;
  name: string;
};

// Specific type for attendance marking session display on mark-attendance page
export type MarkedAttendanceEntry = {
  memberItsId: string;
  memberName: string;
  timestamp: Date; // This is a Date object for local display formatting
  miqaatId: string;
  miqaatName: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO Date string
  read: boolean;
};

// For displaying results in the reports table
export interface ReportResultItem {
  id: string; // Can be attendance record ID or user ID for non-attendance
  userName: string;
  userItsId: string;
  miqaatName: string; 
  date?: string; // ISO string, represents markedAt for attendance, or N/A for non-attendance summary
  status: "Present" | "Absent" | "Late" | "N/A"; // 'Late' is not implemented yet
  markedByItsId?: string;
}
