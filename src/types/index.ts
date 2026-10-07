export type PolicyStatus = 
  | 'IN_FORCE' 
  | 'LAPSED' 
  | 'PAID_UP' 
  | 'SURRENDERED' 
  | 'MATURED' 
  | 'CLAIM_PAID';

export type PremiumFrequency = 
  | 'YEARLY' 
  | 'HALF_YEARLY' 
  | 'QUARTERLY' 
  | 'MONTHLY_NACH' 
  | 'SINGLE_PREMIUM';

export interface Customer {
  id: string;
  fullName: string;
  mobile: string;
  email?: string;
  address?: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  occupation?: string;
  panNumber?: string;
  aadhaarLast4?: string;
  emergencyContact?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  customerId: string;
  customerName?: string; // Denormalized for rapid searching
  customerMobile?: string;
  
  planNumber: string;
  planName: string;
  sumAssured: number;
  basicPremium: number;
  gstAmount: number;
  totalPremium: number;
  frequency: PremiumFrequency;
  
  policyTermYears: number;
  premiumPayingTermYears: number;
  dateOfCommencement: string; // YYYY-MM-DD
  dateOfMaturity: string; // YYYY-MM-DD
  nextDueDate: string; // YYYY-MM-DD
  lastPaidDate?: string;
  
  status: PolicyStatus;
  nomineeName: string;
  nomineeRelationship: string;
  nomineeAge?: number;
  
  branchCode: string;
  agencyCode: string;
  developmentOfficer?: string;
  
  commencementYear: number;
  financialYear?: string; // e.g. '2013-2014', '2014-2015', etc.
  sheetName?: string;
  ledgerSerialNo?: number;
  scannedDocumentId?: string;
  documentThumb?: string;
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'RESTORE' | 'OCR_DIGITIZE' | 'LOGIN' | 'LOCK';
  entityType: 'POLICY' | 'CUSTOMER' | 'SYSTEM' | 'BACKUP';
  entityId?: string;
  entitySummary: string;
  userName: string;
  userRole: string;
  details?: Record<string, any>;
}

export interface ScannedDocument {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  dataUrl: string; // Base64 or Blob URL
  ocrStatus: 'PENDING' | 'PARSED' | 'VERIFIED' | 'FAILED';
  extractedText?: string;
  policyId?: string;
  extractedFields?: {
    policyNumber?: string;
    customerName?: string;
    planName?: string;
    planNumber?: string;
    sumAssured?: number;
    premium?: number;
    frequency?: PremiumFrequency;
    dateOfCommencement?: string;
    dateOfMaturity?: string;
    confidenceScore?: number;
  };
}

export interface AppSettings {
  agencyName: string;
  agentCode: string;
  agentName: string;
  branchCode: string;
  divisionName: string;
  contactPhone: string;
  contactEmail: string;
  pinProtected: boolean;
  pinCode?: string;
  isLocked: boolean;
  maskSensitiveData: boolean;
  theme: 'dark' | 'light';
  currencySymbol: string;
  notificationsEnabled?: boolean;
  reminderDaysBefore?: number;
}

export interface DashboardStats {
  totalPolicies: number;
  activePolicies: number;
  totalSumAssured: number;
  annualPremiumPortfolio: number;
  duesNext30Days: number;
  dueAmountNext30Days: number;
  lapsedCount: number;
  maturedCount: number;
  totalCustomers: number;
}
