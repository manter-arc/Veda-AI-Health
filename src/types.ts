export interface UserProfile {
  uid?: string;
  email?: string;
  name: string;
  age: string;
  sex: string;
  city: string;
  height: string;
  weight: string;
  bp: string;
  sugar: string;
  blood: string;
  conditions: string[];
  medicines: { 
    name: string; 
    dose: string; 
    dailyFrequency: number; 
    totalQuantity: number; 
    lastRefillDate: string; 
  }[];
  familyHistory: string[];
  allergies: string[];
  vaccinationHistory: string[];
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  company?: string;
  corporateId?: string;
  setupDone: boolean;
  notificationsEnabled?: boolean;
  streakCount?: number;
  lastTrackedDate?: string;
  vitalityScore?: number;
  updatedAt?: string;
  isPremium?: boolean;
  accessLogs?: AccessLogEntry[];
  familyPermissions?: FamilyPermission[];
}

export interface AccessLogEntry {
  id: string;
  resource: string;
  action: 'view' | 'export' | 'update';
  timestamp: string;
  accessedBy: string;
}

export interface FamilyPermission {
  memberId: string;
  name: string;
  canViewAlerts: boolean;
  canViewMedications: boolean;
  canViewRecords: boolean;
  canViewLocker: boolean;
  isCaregiver: boolean;
}

export interface JournalEntry {
  date: string;
  time: string;
  mood: number;
  sleep: number;
  energy: number;
  bpSys?: string;
  bpDia?: string;
  sugar?: string;
  weight?: string;
  steps?: string;
  symptoms: string[];
  notes: string;
}

export interface Reminder {
  id: number | string;
  name: string;
  dose: string;
  time: string;
  freq: string;
  on: boolean;
  color: string;
  note?: string;
  category?: 'medicine' | 'refill' | 'test' | 'other';
  refillDays?: number;
}

export interface MedicalRecord {
  id: string | number;
  type: string;
  title: string;
  date: string;
  doctor: string;
  notes: string;
  tags: string[];
  photo?: string;
  labValues?: string;
  diagnosis?: string;
  medicines?: string;
  hospital?: string;
  status?: string;
  color?: string;
  fileUrl?: string;
  createdAt?: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  relation: string;
  age: string;
  score: number;
  medicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  reminders?: Reminder[];
  appointments?: Appointment[];
  canAccessLocker?: boolean;
  canAccessSOS?: boolean;
  isEmergencyContact?: boolean;
}

export interface InsurancePlan {
  id: string;
  name: string;
  provider: string;
  monthlyPremium: number;
  coverAmount: string;
  features: string[];
  waitingPeriod?: string;
  coPay?: string;
  cashlessHospitals?: string;
}

export interface UserInsurancePolicy {
  id: string;
  policyName: string;
  policyNumber: string;
  provider: string;
  premium: string;
  expiryDate: string;
  insuredMembers: string[];
  coverageAmount: string;
  status: 'active' | 'expiring' | 'lapsed';
}

export interface Appointment {
  id: string;
  clinicId: string;
  clinicName: string;
  date: string;
  time: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  patientName: string;
  patientId: string;
  type: string;
}

export interface Clinic {
  id: string;
  name: string;
  dist: string;
  rating: string;
  open: string;
  icon: string;
  category: string;
  address: string;
  specialties: string[];
}

export interface CorporateChallenge {
  id: string;
  title: string;
  description: string;
  type: 'steps' | 'calories' | 'sleep' | 'mindfulness';
  target: number;
  current: number;
  endDate: string;
  participants: number;
  reward?: string;
  status: 'active' | 'completed' | 'joined';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface HealthDocument {
  id: string;
  name: string;
  category: 'prescription' | 'scan' | 'report' | 'insurance' | 'other';
  date: string;
  fileData: string; // Base64 for simplicity in this environment
  notes?: string;
  isEncrypted: boolean;
  mimeType: string;
}

export type AppMode = 
  | 'landing'
  | 'home'
  | 'chat'
  | 'symptoms'
  | 'blog'
  | 'blog_article'
  | 'symptom_detail'
  | 'medication'
  | 'lab'
  | 'triage'
  | 'rx'
  | 'journal'
  | 'score'
  | 'patterns'
  | 'advice'
  | 'skin'
  | 'food'
  | 'mind'
  | 'roadmap'
  | 'opinion'
  | 'doctor'
  | 'hospital'
  | 'records'
  | 'family'
  | 'alerts'
  | 'medicine'
  | 'insurance'
  | 'reminders'
  | 'clinic'
  | 'corporate'
  | 'edu'
  | 'vitals'
  | 'scanner'
  | 'teleconsult'
  | 'calendar'
  | 'bmi'
  | 'wearable'
  | 'onboarding'
  | 'auth'
  | 'privacy'
  | 'trust'
  | 'wellness'
  | 'sos'
  | 'membership'
  | 'locker'
  | 'profile';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  duration?: number;
}
