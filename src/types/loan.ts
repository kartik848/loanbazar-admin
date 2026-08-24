export type ApplicationStatus = 'under_review' | 'approved' | 'autopay_done' | 'disbursed' | 'rejected';

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
  monthlyEmi: number;
  totalRepayment: number;

  // Document URLs
  panUrl?: string;
  aadhaarUrl?: string;
  incomeProofUrl?: string;
  bankStatementUrl?: string;
  proofUrl?: string;

  // Workflow & Status
  status: ApplicationStatus;
  isBlocked: boolean;
  rbiConsentAccepted: boolean;
  autoPayConsentAccepted?: boolean;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  disbursedBy?: string;
  disbursedAt?: string;
  createdAt?: any;
}
