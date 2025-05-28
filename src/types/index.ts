
export type UserRole = 'user' | 'admin' | 'superadmin' | 'attendance-marker';

export type User = {
  id: string;
  itsId: string;
  bgkId?: string;
  name: string;
  team?: string;
  phoneNumber?: string;
  mohallah?: string;
  role: UserRole;
  avatarUrl?: string;
};

export type Miqaat = {
  id: string;
  name: string;
  startTime: string; // ISO Date string
  endTime: string; // ISO Date string
  teams: string[];
  barcodeData?: string; 
  location?: string;
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

export type Mohallah = {
  id: string;
  name: string;
  members: User[];
  admin?: User
};

// Specific type for attendance marking session
export type MarkedAttendanceEntry = {
  memberItsId: string;
  memberName: string;
  timestamp: Date;
  miqaatId: string;
  miqaatName: string;
};
