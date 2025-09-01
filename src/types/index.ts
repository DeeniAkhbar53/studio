
export type UserRole = 'user' | 'admin' | 'superadmin' | 'attendance-marker';
export type UserDesignation = 'Captain' | 'Vice Captain' | 'Member';

export type User = {
  id: string;
  itsId: string;
  bgkId?: string;
  name: string;
  password?: string; // For admin/superadmin login
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
  status: 'present' | 'late' | 'early' | 'safar';
  uniformCompliance?: {
      fetaPaghri: 'yes' | 'no' | 'safar';
      koti: 'yes' | 'no' | 'safar';
  }
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
  uniformRequirements?: {
      fetaPaghri: boolean;
      koti: boolean;
  };
};

export type AttendanceRecord = {
  id: string;
  miqaatId: string;
  miqaatName: string;
  userItsId: string;
  userName: string;
  markedAt: string; // ISO string
  markedByItsId?: string;
  status: 'present' | 'late' | 'early' | 'absent' | 'safar';
  uniformCompliance?: {
      fetaPaghri: 'yes' | 'no' | 'safar';
      koti: 'yes' | 'no' | 'safar';
  }
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
  status?: 'present' | 'late' | 'early';
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
  status: "Present" | "Absent" | "Late" | "Early" | "Safar";
  markedByItsId?: string;
  uniformCompliance?: {
    fetaPaghri: 'yes' | 'no' | 'safar';
    koti: 'yes' | 'no' | 'safar';
  };
}

export interface PageRightConfig {
  id: string;
  label: string;
  path: string;
  description?: string;
  defaultRoles?: UserRole[];
}

// Types for the new Forms feature
export type FormFieldType = 'text' | 'textarea' | 'checkbox' | 'radio' | 'select';

export interface FormQuestion {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // For radio, checkbox, select
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  questions: FormQuestion[];
  createdBy: string; // ITS ID of creator
  createdAt: string; // ISO string
  responseCount?: number;
  status: 'open' | 'closed'; // Status for accepting responses
  updatedBy?: string; // ITS ID of user who last updated
  updatedAt?: string; // ISO string of last update
}

export interface FormResponse {
    id: string;
    formId: string;
    submittedBy: string; // ITS ID of submitter
    submitterName: string; // Name of submitter for easy reference
    submitterBgkId?: string | null; // BGK ID of submitter
    submittedAt: string; // ISO string
    responses: {
        [questionId: string]: string | string[]; // Answer keyed by question ID
    }
}

// New type for System Logs
export interface SystemLog {
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    context?: string; // stringified JSON
    timestamp: string; // ISO string
}
