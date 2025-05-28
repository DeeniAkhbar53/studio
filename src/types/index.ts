export type User = {
  id: string;
  itsId: string;
  bgkId?: string;
  name: string;
  team?: string;
  phoneNumber?: string;
  mohallah?: string;
  role: 'user' | 'admin' | 'superadmin';
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
  miqaatName: string;
  date: string; // ISO Date string
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