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

export type AppMode = 
  | 'landing'
  | 'home'
  | 'chat'
  | 'symptoms'
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
  | 'profile';
