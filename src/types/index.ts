
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
  pageRights?: string[];
  fcmTokens?: string[]; // For storing FCM registration tokens
};

export type MiqaatAttendanceEntryItem = {
  userItsId: string;
  userName: string;
  markedAt: string; // ISO string
  markedByItsId: string;
  status?: 'present' | 'late' | 'early'; // New status field
};

export type Miqaat = {
  id: string;
  name: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  reportingTime?: string; // ISO string, for "on-time" threshold
  mohallahIds?: string[];
  teams?: string[];
  barcodeData?: string;
  location?: string;
  createdAt?: string; // ISO string
  attendance?: MiqaatAttendanceEntryItem[];
  attendedUserItsIds?: string[];
};

export type AttendanceRecord = {
  id: string;
  miqaatId: string;
  miqaatName: string;
  userItsId: string;
  userName: string;
  markedAt: string; // ISO string
  markedByItsId?: string;
  status?: 'present' | 'late' | 'early'; // New status field
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
  createdAt?: string; // ISO string
};

export type MarkedAttendanceEntry = {
  memberItsId: string;
  memberName: string;
  timestamp: Date;
  miqaatId: string;
  miqaatName: string;
  status?: 'present' | 'late' | 'early'; // New status field
};

export type NotificationItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string; // ISO string
  targetAudience: 'all' | UserRole;
  createdBy: string; // ITS ID of creator
  readBy?: string[]; // Array of ITS IDs of users who have read it
};

export interface ReportResultItem {
  id: string;
  userName: string;
  userItsId: string;
  miqaatName: string;
  date?: string; // ISO string
  status: "Present" | "Absent" | "Late" | "Early" | "N/A"; // Updated status type
  markedByItsId?: string;
}

export interface PageRightConfig {
  id: string;
  label: string;
  path: string;
  description?: string;
  defaultRoles?: UserRole[];
}

    