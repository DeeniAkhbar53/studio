
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

// Represents a single attendance entry as stored within a Miqaat's attendance array
export type MiqaatAttendanceEntryItem = {
  userItsId: string;
  userName: string;
  markedAt: string; // ISO string of the timestamp when marked
  markedByItsId: string; // ITS ID of the person who marked attendance
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
  attendance?: MiqaatAttendanceEntryItem[]; // Array of attendance entries for this Miqaat
};

// This type is primarily for UI/reporting, mapping data from MiqaatAttendanceEntryItem
export type AttendanceRecord = {
  id: string; // For UI keys, can be synthetic (e.g., miqaatId + userItsId + markedAt)
  miqaatId: string;
  miqaatName: string; 
  userItsId: string;
  userName: string; 
  markedAt: string; // ISO Date string of the timestamp when marked
  markedByItsId: string; 
};

export type Team = {
  id: string;
  name: string;
  members: User[];
  leader?: User;
};

export type Mohallah = {
  id: string;
  name: string;
};

export type MarkedAttendanceEntry = {
  memberItsId: string;
  memberName: string;
  timestamp: Date; 
  miqaatId: string;
  miqaatName: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string; 
  read: boolean;
};

export interface ReportResultItem {
  id: string; 
  userName: string;
  userItsId: string;
  miqaatName: string; 
  date?: string; 
  status: "Present" | "Absent" | "Late" | "N/A"; 
  markedByItsId?: string;
}
