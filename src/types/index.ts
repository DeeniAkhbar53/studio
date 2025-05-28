
export type UserRole = 'user' | 'admin' | 'superadmin' | 'attendance-marker';

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
  id: string;
  miqaatId: string;
  miqaatName: string; // This can be derived, but good for display
  userId?: string; // ID of the user whose attendance is recorded
  userItsId?: string; // ITS ID of the user
  userName?: string; // Name of the user
  date: string; // ISO Date string of when attendance was marked
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
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

// Specific type for attendance marking session
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
  createdAt: string; // ISO Date string
  read: boolean;
};
