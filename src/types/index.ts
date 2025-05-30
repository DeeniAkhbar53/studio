
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
  markedAt: string;
  markedByItsId: string;
};

export type Miqaat = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  reportingTime?: string;
  mohallahIds?: string[];
  teams?: string[];
  barcodeData?: string;
  location?: string;
  createdAt?: string;
  attendance?: MiqaatAttendanceEntryItem[];
  attendedUserItsIds?: string[];
};

export type AttendanceRecord = {
  id: string;
  miqaatId: string;
  miqaatName: string;
  userItsId: string;
  userName: string;
  markedAt: string;
  markedByItsId?: string;
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
  createdAt?: string;
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
  date?: string;
  status: "Present" | "Absent" | "Late" | "N/A";
  markedByItsId?: string;
}

export interface PageRightConfig {
  id: string;
  label: string;
  path: string;
  description?: string;
  defaultRoles?: UserRole[];
}
