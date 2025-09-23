
export type UserRole = 'user' | 'admin' | 'superadmin' | 'attendance-marker';
export type UserDesignation = 'Captain' | 'Vice Captain' | 'Member' | 'Asst.Grp Leader' | 'Group Leader' | 'J.Member' | 'Major';

export type User = {
  id: string;
  itsId: string;
  bgkId?: string;
  name: string;
  email?: string; // Added email field
  password?: string; // For admin/superadmin login
  team?: string;
  managedTeams?: string[]; // For Vice Captains to manage multiple teams
  phoneNumber?: string;
  mohallahId?: string;
  role: UserRole;
  avatarUrl?: string;
  designation?: UserDesignation;
  pageRights?: string[];
  fcmTokens?: string[]; // For storing FCM registration tokens
  lastLogin?: string; // ISO string, updated on login
};

export type MiqaatSession = {
  id: string;
  day: number;
  name: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  reportingTime?: string; // ISO string
};

export type MiqaatAttendanceEntryItem = {
  userItsId: string;
  userName: string;
  sessionId?: string; // To link attendance to a specific session
  markedAt: string; // ISO string
  markedByItsId: string;
  status: 'present' | 'late' | 'early';
  uniformCompliance?: {
      fetaPaghri?: 'yes' | 'no' | 'safar';
      koti?: 'yes' | 'no' | 'safar';
      nazrulMaqam?: {
          amount: number;
          currency: string;
      }
  }
};

export type MiqaatSafarEntryItem = {
  userItsId: string;
  userName: string;
  sessionId?: string;
  markedAt: string;
  markedByItsId: string;
  status: 'safar';
}

export type Miqaat = {
  id: string;
  name: string;
  type: 'local' | 'international';
  attendanceType?: 'single' | 'multiple'; // For international miqaats
  startTime: string; // Overall start time
  endTime: string; // Overall end time
  reportingTime?: string; // For local miqaats
  sessions?: MiqaatSession[]; // For international miqaats
  mohallahIds?: string[];
  teams?: string[];
  eligibleItsIds?: string[]; // For specific member selection
  barcodeData?: string;
  location?: string;
  createdAt?: string; // ISO string
  attendance?: MiqaatAttendanceEntryItem[];
  safarList?: MiqaatSafarEntryItem[];
  attendedUserItsIds?: string[];
  attendanceRequirements?: { fetaPaghri: boolean, koti: boolean, nazrulMaqam: boolean };
};

export type AttendanceRecord = {
  id: string;
  miqaatId: string;
  miqaatName: string;
  userItsId: string;
  userName: string;
  markedAt: string; // ISO string
  markedByItsId?: string;
  status: 'present' | 'late' | 'early' | 'absent' | 'safar' | 'not-eligible';
  uniformCompliance?: MiqaatAttendanceEntryItem['uniformCompliance'];
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
  sessionId: string;
  sessionName: string;
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
  bgkId?: string;
  team?: string;
  miqaatName: string;
  sessionName?: string; // New field for session name
  date?: string; // ISO string
  status: "present" | "absent" | "late" | "early" | "safar" | "not-eligible"; // Added safar and not-eligible
  markedByItsId?: string;
  uniformCompliance?: MiqaatAttendanceEntryItem['uniformCompliance'];
}

export interface PageRightConfig {
  id: string;
  label: string;
  path: string;
  description?: string;
  defaultRoles?: UserRole[];
}

// Types for the new Forms feature
export type FormFieldType = 'text' | 'textarea' | 'checkbox' | 'radio' | 'select' | 'rating' | 'number' | 'date';

export interface FormQuestion {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // For radio, checkbox, select
  conditional?: {
    questionId: string; // ID of the question this one depends on
    value: string; // The answer value that must be selected to show this question
  };
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string; // For the cover image Data URI
  questions: FormQuestion[];
  createdBy: string; // ITS ID of creator
  createdAt: string; // ISO string
  responseCount?: number;
  status: 'open' | 'closed'; // Status for accepting responses
  endDate?: string; // ISO string for form expiration
  updatedBy?: string; // ITS ID of user who last updated
  updatedAt?: string; // ISO string
  mohallahIds?: string[];
  teams?: string[];
  eligibleItsIds?: string[];
}

export interface FormResponse {
    id: string;
    formId: string;
    submittedBy: string; // ITS ID of submitter
    submitterName: string;
    submitterBgkId?: string | null; // BGK ID of submitter
    submittedAt: string; // ISO string
    responses: {
        [questionId: string]: string | string[] | number | null; // Answer keyed by question ID
    }
}

// Renamed from SystemLog to represent login logs, but keeping name for now.
export interface SystemLog {
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    context?: string; // stringified JSON
    timestamp: string; // ISO string
}
