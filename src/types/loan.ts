export type ApplicationStatus =
  | 'under_review'
  | 'approved'
  | 'acceptance_submitted'
  | 'acceptance_done'
  | 'autopay_done'
  | 'disbursed'
  | 'repaid'
  | 'rejected';

export interface LoanRepaymentRecord {
  id?: string;
  applicationId?: string;
  paymentId: string;
  amount: number;
  baseEmi?: number;
  penaltyPaid?: number;
  penaltyWaived?: number;
  emiNumber?: number;
  totalEmis?: number;
  paidAt: string | any;
  method?: string;
  paymentMode?: string;
  screenshotUrl?: string;
  notes?: string;
  userName?: string;
  userPhone?: string;
  status?: 'pending_verification' | 'verified' | 'rejected';
  type?: 'acceptance_fee' | 'emi_repayment' | string;
  isFinalSettlement?: boolean;
  rejectedReason?: string;
  rejectedAt?: string | any;
  rejectedBy?: string;
  verifiedAt?: string | any;
  verifiedBy?: string;
  collectedBy?: string;
}

export interface LoanApplication {
  id: string;
  fullName: string;
  userPhone: string;
  userEmail: string;
  aadhaarNumber: string;
  panNumber: string;
  employmentType: 'salaried' | 'business';
  monthlyIncome: number;

  // Bank Disbursal Account Details
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;

  // Loan Financials
  amount: number;
  interestRate: number;
  tenureMonths: number;
  tenureDays?: number;
  tenureDisplay?: string;
  monthlyEmi: number;
  totalRepayment: number;
  processingFee?: number;
  netDisbursalAmount?: number;

  // Document URLs
  panUrl?: string;
  aadhaarUrl?: string;
  incomeProofUrl?: string;
  bankStatementUrl?: string;
  proofUrl?: string;
  selfieUrl?: string;
  housePhotoUrl?: string;
  homePhotoUrl?: string;

  // Workflow, Acceptance & Disbursal Status
  status: ApplicationStatus;
  isBlocked: boolean;
  rbiConsentAccepted: boolean;
  userConsentApproved?: boolean;
  autoPayConsentAccepted?: boolean;
  acceptanceFeePaid?: boolean;
  acceptancePaymentId?: string;
  acceptanceScreenshotUrl?: string;
  acceptanceSubmittedAt?: string | any;
  acceptancePaidAt?: string | any;
  acceptanceRejectReason?: string;
  pendingEmiPaymentId?: string;
  pendingEmiAmount?: number;
  pendingEmiScreenshotUrl?: string;
  pendingEmiSubmittedAt?: string | any;
  pendingEmiRejectReason?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  disbursedBy?: string;
  disbursedAt?: string;
  dueDate?: string | any;
  nextEmiDueDate?: string | any;
  emisPaid?: number;
  totalEmis?: number;
  penaltyPerDay?: number;
  penaltyWaived?: number;
  repaidAt?: string | any;
  lastPaymentId?: string;
  lastPaymentAt?: string | any;
  lastPaymentAmount?: number;
  repayments?: LoanRepaymentRecord[];
  createdAt?: any;
}
