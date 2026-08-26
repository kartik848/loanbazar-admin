export type ApplicationStatus =
  | 'under_review'
  | 'approved'
  | 'acceptance_done'
  | 'autopay_done'
  | 'disbursed'
  | 'repaid'
  | 'rejected';

export interface LoanRepaymentRecord {
  id?: string;
  paymentId: string;
  amount: number;
  emiNumber: number;
  paidAt: string | any;
  method?: string;
  penaltyPaid?: number;
  penaltyWaived?: number;
  notes?: string;
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
  acceptancePaidAt?: string | any;
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
  repayments?: LoanRepaymentRecord[];
  createdAt?: any;
}
