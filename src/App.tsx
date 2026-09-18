import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
  addDoc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCzvSmn2A_kSLrDfA3frRzj2WWwFs7p3VQ",
  appId: "1:536165799568:web:d57bd180486fd4f319ea15",
  messagingSenderId: "536165799568",
  projectId: "loan-bazaar-3a60b",
  authDomain: "loan-bazaar-3a60b.firebaseapp.com",
  storageBucket: "loan-bazaar-3a60b.firebasestorage.app",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function calculateAdminLoan(principal: any, annualRate: any, tenureMonths: any, tenureDays?: any) {
  const p = Number(principal) || 0;
  const r = Number(annualRate) || 0;
  const tDays = Number(tenureDays) || 0;
  const tMonths = Number(tenureMonths) || 0;
  const isDays = (tDays === 7 || tDays === 15) || (tDays > 0 && tMonths === 0);
  const pFee = 0;
  const netDisbursal = p;

  if (p <= 0) {
    return { emi: 0, totalRepayment: 0, totalInterest: 0, processingFee: 0, netDisbursal: 0, isDays: false, tenureDisplay: '0 Days', frequencyText: 'Single Bullet' };
  }

  if (isDays) {
    const days = tDays > 0 ? tDays : 7;
    const totalInterest = Math.round(p * (r / 100));
    const totalRepayment = p + totalInterest;
    return {
      emi: totalRepayment,
      totalRepayment,
      totalInterest,
      processingFee: pFee,
      netDisbursal,
      isDays: true,
      tenureDisplay: `${days} Days`,
      frequencyText: `Single Bullet in ${days} Days`
    };
  } else {
    const months = tMonths > 0 ? tMonths : Math.max(1, Math.round(tDays / 30));
    const tenureDisplay = months === 12 ? '1 Year (12 Months)' : `${months} Month${months > 1 ? 's' : ''}`;
    
    if (months === 1) {
      const totalInterest = Math.round(p * (r / 100));
      const totalRepayment = p + totalInterest;
      return {
        emi: totalRepayment,
        totalRepayment,
        totalInterest,
        processingFee: pFee,
        netDisbursal,
        isDays: false,
        tenureDisplay,
        frequencyText: 'Single 1-Month Repayment'
      };
    } else {
      const totalInterest = Math.round(p * (r / 100) * (months / 12));
      const totalRepayment = p + totalInterest;
      const emi = Math.round(totalRepayment / months);
      return {
        emi,
        totalRepayment,
        totalInterest,
        processingFee: pFee,
        netDisbursal,
        isDays: false,
        tenureDisplay,
        frequencyText: `₹${emi.toLocaleString('en-IN')}/mo for ${months} Mo`
      };
    }
  }
}

// Compute dynamic overdue days, penalty (@ ₹100/day), and total due
function computeLoanCollectionMetrics(app: any) {
  const emi = Number(app.monthlyEmi) || 0;
  if (app.status !== 'disbursed') {
    return {
      dueDate: null,
      dueDateFormatted: '—',
      overdueDays: 0,
      isOverdue: false,
      penalty: 0,
      rawPenalty: 0,
      penaltyWaived: 0,
      totalDue: emi,
      statusLabel: app.status === 'repaid' ? 'Paid & Settled' : 'Not Disbursed',
    };
  }

  let dueTimestamp = null;
  if (app.nextEmiDueDate?.toMillis) {
    dueTimestamp = app.nextEmiDueDate.toMillis();
  } else if (app.nextEmiDueDate) {
    dueTimestamp = new Date(app.nextEmiDueDate).getTime();
  } else if (app.dueDate?.toMillis) {
    dueTimestamp = app.dueDate.toMillis();
  } else if (app.dueDate) {
    dueTimestamp = new Date(app.dueDate).getTime();
  } else {
    const baseMillis = app.disbursedAt ? new Date(app.disbursedAt).getTime() : (app.createdAt?.toMillis ? app.createdAt.toMillis() : Date.now());
    const daysToAdd = app.tenureDays > 0 ? app.tenureDays : (app.tenureMonths > 0 ? 30 : 7);
    dueTimestamp = baseMillis + (daysToAdd * 24 * 60 * 60 * 1000);
  }

  const dueDate = new Date(dueTimestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueCalendar = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
  const diffDays = Math.floor((today - dueCalendar) / (1000 * 60 * 60 * 24));

  const overdueDays = diffDays > 0 ? diffDays : 0;
  const isOverdue = overdueDays > 0;
  const penaltyRate = Number(app.penaltyPerDay) || 100;
  const penalty = overdueDays * penaltyRate;
  const penaltyWaived = Number(app.penaltyWaived) || 0;
  const effectivePenalty = Math.max(0, penalty - penaltyWaived);
  const totalDue = Math.round(emi + effectivePenalty);

  const dueDateFormatted = dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  let statusLabel = 'On Track';
  if (isOverdue) {
    statusLabel = `Overdue (${overdueDays}d Late)`;
  } else if (diffDays === 0) {
    statusLabel = 'Due Today';
  } else if (diffDays >= -3) {
    statusLabel = `Due in ${Math.abs(diffDays)}d`;
  }

  return {
    dueDate,
    dueDateFormatted,
    overdueDays,
    isOverdue,
    penalty: effectivePenalty,
    rawPenalty: penalty,
    penaltyWaived,
    totalDue,
    statusLabel,
  };
}

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Navigation View State ('applications' | 'collections' | 'users')
  const [activeView, setActiveView] = useState<'applications' | 'collections' | 'users'>('applications');

  // Applications State
  const [applications, setApplications] = useState<any[]>([]);
  const [adminRates, setAdminRates] = useState<Record<string, number>>({});
  const [selectedDoc, setSelectedDoc] = useState<{ title: string; url: string } | null>(null);
  const [detailedApp, setDetailedApp] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Live Repayments Stream State
  const [repaymentsList, setRepaymentsList] = useState<any[]>([]);

  // Collection Page State
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'overdue' | 'due_soon' | 'repaid'>('all');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [recordingLoan, setRecordingLoan] = useState<any | null>(null);
  const [recordAmount, setRecordAmount] = useState<number>(0);
  const [recordUtr, setRecordUtr] = useState<string>('');
  const [recordMode, setRecordMode] = useState<string>('razorpay');
  const [recordWaived, setRecordWaived] = useState<number>(0);
  const [recordNotes, setRecordNotes] = useState<string>('');

  // Waive Penalty Modal State
  const [waivingLoan, setWaivingLoan] = useState<any | null>(null);
  const [waiveAmount, setWaiveAmount] = useState<number>(0);

  // Users Directory Search State
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Firestore Realtime Listener
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      // 1. Applications Stream
      const unsubApps = onSnapshot(collection(db, 'applications'), (snapshot) => {
        if (!snapshot.empty) {
          const liveDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          liveDocs.sort((a: any, b: any) => {
            const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return tB - tA;
          });
          setApplications(liveDocs);
        }
      }, (error) => {
        console.warn("Firestore applications listener fallback: ", error.message);
      });

      // 2. Automated Repayments Live Stream
      const unsubRepayments = onSnapshot(collection(db, 'repayments'), (snapshot) => {
        if (!snapshot.empty) {
          const liveRepayments = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          liveRepayments.sort((a: any, b: any) => {
            const tA = a.paidAt?.toMillis ? a.paidAt.toMillis() : (a.paidAt ? new Date(a.paidAt).getTime() : 0);
            const tB = b.paidAt?.toMillis ? b.paidAt.toMillis() : (b.paidAt ? new Date(b.paidAt).getTime() : 0);
            return tB - tA;
          });
          setRepaymentsList(liveRepayments);
        }
      }, (error) => {
        console.warn("Firestore repayments listener fallback: ", error.message);
      });

      // 3. Registered Users Stream
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        if (!snapshot.empty) {
          const liveUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRegisteredUsers(liveUsers);
        }
      }, (error) => {
        console.warn("Firestore users listener fallback: ", error.message);
      });

      return () => {
        unsubApps();
        unsubRepayments();
        unsubUsers();
      };
    } catch (e) {
      console.warn("Firestore init error: ", e);
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.trim() === 'admin@gmail.com' && passwordInput === '123456') {
      setIsAuthenticated(true);
      localStorage.setItem('loanbazar_admin_auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Invalid email or password! Please check credentials.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('loanbazar_admin_auth');
  };

  // 1. Admin Approve Loan Offer
  const handleApprove = async (id: string, name: string, appItem: any, specificRate?: number) => {
    const chosenRate = specificRate !== undefined ? specificRate : (adminRates[id] !== undefined ? adminRates[id] : (Number(appItem.interestRate) || 14.0));
    const calc = calculateAdminLoan(appItem.amount, chosenRate, appItem.tenureMonths, appItem.tenureDays);
    
    const confirmMsg = `CONFIRM APPROVAL:\n\nApplicant: ${name}\nSanctioned Amount: ₹${Number(appItem.amount).toLocaleString('en-IN')}\nApproved Rate: ${chosenRate}% p.a.\nTenure: ${calc.tenureDisplay}\n${calc.isDays ? 'Bullet Due' : 'Monthly EMI'}: ₹${calc.emi.toLocaleString('en-IN')}\nTotal Repay: ₹${calc.totalRepayment.toLocaleString('en-IN')}\nNet Disbursal: ₹${calc.netDisbursal.toLocaleString('en-IN')}\n\nApprove offer? The user will be requested to pay ₹1 acceptance fee.`;
    if (!window.confirm(confirmMsg)) return;

    const updateData = {
      status: 'approved',
      interestRate: chosenRate,
      monthlyEmi: calc.emi,
      totalRepayment: calc.totalRepayment,
      totalInterest: calc.totalInterest,
      processingFee: calc.processingFee,
      netDisbursalAmount: calc.netDisbursal,
      tenureDisplay: calc.tenureDisplay,
      approvedBy: 'admin@gmail.com',
      approvedAt: new Date().toISOString(),
      userConsentApproved: false,
      acceptanceFeePaid: false,
    };
    try {
      await updateDoc(doc(db, 'applications', id), updateData);
    } catch (err) {
      console.warn("Firestore update fallback:", err);
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
  };

  // 2. Admin Decline / Reject Loan
  const handleReject = async (id: string, name: string) => {
    const reason = window.prompt(`Enter rejection reason for ${name}:`, "Income documents or credit criteria not verified");
    if (reason === null) return;
    const updateData = {
      status: 'rejected',
      rejectedBy: 'admin@gmail.com',
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason || 'Application rejected by credit team',
    };
    try {
      await updateDoc(doc(db, 'applications', id), updateData);
    } catch {
      // Local fallback
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
  };

  // 2.1 Admin Approve ₹1 Acceptance Fee Payment (Payment Received)
  const handleApproveAcceptance = async (id: string, appItem: any) => {
    const utr = appItem.acceptancePaymentId || appItem.razorpayPaymentId || 'Verified';
    if (!window.confirm(`CONFIRM ₹1 PAYMENT APPROVAL:\n\nApplicant: ${appItem.fullName}\nSubmitted UTR / Ref: ${utr}\n\nHave you verified ₹1 in Razorpay or Bank statement?\nApproving will verify acceptance and enable immediate bank disbursal.`)) return;

    const now = new Date();
    const updateData: any = {
      status: 'acceptance_done',
      acceptanceFeePaid: true,
      acceptancePaidAt: now.toISOString(),
      userConsentApproved: true,
      autoPayConsentAccepted: true,
      acceptanceRejectReason: null,
      acceptanceApprovedBy: 'admin@gmail.com',
      acceptanceApprovedAt: now.toISOString(),
    };

    try {
      await updateDoc(doc(db, 'applications', id), updateData);

      // Update matching repayments entry to verified
      const repSnap = await getDocs(query(collection(db, 'repayments'), where('applicationId', '==', id)));
      for (const d of repSnap.docs) {
        if (d.data().type === 'acceptance_fee') {
          await updateDoc(doc(db, 'repayments', d.id), { status: 'verified', verifiedAt: now.toISOString(), verifiedBy: 'admin@gmail.com' });
        }
      }
    } catch (err) {
      console.warn("Firestore approve acceptance fallback:", err);
    }

    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
    alert(`✓ ₹1 Payment for ${appItem.fullName} approved successfully! Now ready for bank disbursal.`);
  };

  // 2.2 Admin Reject ₹1 Acceptance Fee Payment
  const handleRejectAcceptance = async (id: string, appItem: any) => {
    const reason = window.prompt(`Enter ₹1 verification rejection reason for ${appItem.fullName}:`, "Payment not received in bank account / Invalid UTR reference");
    if (reason === null) return;

    const updateData: any = {
      status: 'approved',
      acceptanceFeePaid: false,
      acceptanceRejectReason: reason || 'Invalid UTR reference / payment not received',
      acceptancePaymentId: null,
      acceptanceScreenshotUrl: null,
      razorpayPaymentId: null,
    };

    try {
      await updateDoc(doc(db, 'applications', id), updateData);

      const repSnap = await getDocs(query(collection(db, 'repayments'), where('applicationId', '==', id)));
      for (const d of repSnap.docs) {
        if (d.data().type === 'acceptance_fee') {
          await updateDoc(doc(db, 'repayments', d.id), { status: 'rejected', rejectedReason: reason, rejectedAt: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.warn("Firestore reject acceptance fallback:", err);
    }

    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
    alert(`✕ ₹1 Payment rejected. User will be asked to re-pay and submit valid UTR in their app.`);
  };

  // 2.3 Admin Approve EMI Repayment (Payment Received)
  const handleApproveEmiRepayment = async (repItem: any) => {
    const loanId = repItem.applicationId;
    const loan = applications.find(a => a.id === loanId);
    if (!loan) {
      alert("Associated loan application not found!");
      return;
    }

    const amt = Number(repItem.amount) || 0;
    if (!window.confirm(`CONFIRM EMI PAYMENT APPROVAL:\n\nBorrower: ${repItem.userName || loan.fullName}\nAmount: ₹${amt.toLocaleString('en-IN')}\nSubmitted UTR / Ref: ${repItem.paymentId}\n\nHave you verified ₹${amt.toLocaleString('en-IN')} in your bank/Razorpay account?\nApproving will advance the loan EMI and update user app in real-time.`)) return;

    const now = new Date();
    const tMonths = Number(loan.tenureMonths) || 0;
    const tDays = Number(loan.tenureDays) || 0;
    const isShortTerm = (tDays === 7 || tDays === 15 || (tDays > 0 && tMonths === 0) || tMonths <= 1);
    const currentPaid = Number(loan.emisPaid) || 0;
    const newPaidCount = currentPaid + 1;
    const totalEmis = Number(loan.totalEmis) || (tMonths > 0 ? tMonths : 1);
    const isFinalSettlement = isShortTerm || (newPaidCount >= totalEmis);
    const nextDue = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const appUpdateData: any = {
      emisPaid: newPaidCount,
      totalRepaidAmount: (Number(loan.totalRepaidAmount) || 0) + amt,
      lastPaymentId: repItem.paymentId,
      lastPaymentAt: now.toISOString(),
      lastPaymentAmount: amt,
      pendingEmiPaymentId: null,
      pendingEmiAmount: null,
      pendingEmiSubmittedAt: null,
      pendingEmiRejectReason: null,
    };

    if (isFinalSettlement) {
      appUpdateData.status = 'repaid';
      appUpdateData.repaidAt = now.toISOString();
    } else {
      appUpdateData.nextEmiDueDate = nextDue.toISOString();
      appUpdateData.dueDate = nextDue.toISOString();
    }

    try {
      if (repItem.id) {
        await updateDoc(doc(db, 'repayments', repItem.id), {
          status: 'verified',
          verifiedAt: now.toISOString(),
          verifiedBy: 'admin@gmail.com',
          isFinalSettlement,
        });
      }
      await updateDoc(doc(db, 'applications', loanId), appUpdateData);
    } catch (err) {
      console.warn("Approve EMI repayment error:", err);
    }

    setApplications(prev => prev.map(a => a.id === loanId ? { ...a, ...appUpdateData } : a));
    setRepaymentsList(prev => prev.map(r => r.id === repItem.id ? { ...r, status: 'verified', verifiedAt: now.toISOString() } : r));
    alert(`✓ EMI payment of ₹${amt.toLocaleString('en-IN')} approved successfully! Loan balance updated.`);
  };

  // 2.4 Admin Reject EMI Repayment
  const handleRejectEmiRepayment = async (repItem: any) => {
    const reason = window.prompt(`Enter EMI rejection reason for ${repItem.userName || 'Borrower'} (UTR: ${repItem.paymentId}):`, "Payment not received in bank account / Invalid UTR reference");
    if (reason === null) return;

    const loanId = repItem.applicationId;
    const now = new Date();

    try {
      if (repItem.id) {
        await updateDoc(doc(db, 'repayments', repItem.id), {
          status: 'rejected',
          rejectedReason: reason,
          rejectedAt: now.toISOString(),
          rejectedBy: 'admin@gmail.com',
        });
      }
      if (loanId) {
        await updateDoc(doc(db, 'applications', loanId), {
          pendingEmiPaymentId: null,
          pendingEmiScreenshotUrl: null,
          pendingEmiRejectReason: reason,
        });
      }
    } catch (err) {
      console.warn("Reject EMI repayment error:", err);
    }

    if (loanId) {
      setApplications(prev => prev.map(a => a.id === loanId ? { ...a, pendingEmiPaymentId: undefined, pendingEmiScreenshotUrl: undefined, pendingEmiRejectReason: reason } : a));
    }
    setRepaymentsList(prev => prev.map(r => r.id === repItem.id ? { ...r, status: 'rejected', rejectedReason: reason } : r));
    alert(`✕ EMI payment rejected. User notified in app.`);
  };

  // 3. Admin Disburse Funds (Initializes EMI schedule and auto-due tracking)
  const handleDisburse = async (id: string, appItem: any) => {
    const bank = appItem.bankName || 'Bank';
    const acc = appItem.accountNumber || '';
    const ifsc = appItem.ifscCode || '';
    const amount = Number(appItem.netDisbursalAmount) || Number(appItem.amount) || 0;

    const confirmMsg = `CONFIRM DISBURSAL:\n\nTransfer ₹${amount.toLocaleString('en-IN')} to:\nAccount Holder: ${appItem.accountHolderName || appItem.fullName}\nBank: ${bank}\nAccount No: ${acc}\nIFSC: ${ifsc}\n\nMark this loan as Disbursed and activate automated EMI schedule?`;
    if (!window.confirm(confirmMsg)) return;

    const now = new Date();
    const tDays = Number(appItem.tenureDays) || 0;
    const tMonths = Number(appItem.tenureMonths) || 0;
    const daysToAdd = tDays > 0 ? tDays : (tMonths > 0 ? 30 : 7);
    const dueDate = new Date(now.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));

    const updateData = {
      status: 'disbursed',
      disbursedBy: 'admin@gmail.com',
      disbursedAt: now.toISOString(),
      dueDate: dueDate.toISOString(),
      nextEmiDueDate: dueDate.toISOString(),
      emisPaid: 0,
      totalEmis: tMonths > 0 ? tMonths : 1,
      penaltyPerDay: 100,
      penaltyWaived: 0,
    };
    try {
      await updateDoc(doc(db, 'applications', id), updateData);
    } catch {
      // Local fallback
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
  };

  // 4. Admin Record EMI Collection Payment (Manual fallback if user pays via cash/IMPS)
  const openRecordModal = (loan: any) => {
    const metrics = computeLoanCollectionMetrics(loan);
    setRecordingLoan(loan);
    setRecordAmount(metrics.totalDue);
    setRecordUtr(`pay_admin_${Date.now().toString().slice(-6)}`);
    setRecordMode('razorpay');
    setRecordWaived(0);
    setRecordNotes('');
  };

  const submitRecordCollection = async () => {
    if (!recordingLoan) return;
    const loan = recordingLoan;
    const tMonths = Number(loan.tenureMonths) || 0;
    const tDays = Number(loan.tenureDays) || 0;
    const isShortTerm = (tDays === 7 || tDays === 15 || (tDays > 0 && tMonths === 0) || tMonths <= 1);
    const currentPaid = Number(loan.emisPaid) || 0;
    const newPaidCount = currentPaid + 1;
    const totalEmis = Number(loan.totalEmis) || (tMonths > 0 ? tMonths : 1);
    const isFinalSettlement = isShortTerm || (newPaidCount >= totalEmis);

    const now = new Date();
    const nextDue = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));

    const updateData: any = {
      emisPaid: newPaidCount,
      lastPaymentId: recordUtr,
      lastPaymentAt: now.toISOString(),
      penaltyWaived: (Number(loan.penaltyWaived) || 0) + Number(recordWaived || 0),
    };

    if (isFinalSettlement) {
      updateData.status = 'repaid';
      updateData.repaidAt = now.toISOString();
    } else {
      updateData.nextEmiDueDate = nextDue.toISOString();
    }

    try {
      const repaymentRecord = {
        applicationId: loan.id,
        paymentId: recordUtr,
        amount: Number(recordAmount),
        emiNumber: newPaidCount,
        paymentMode: recordMode,
        waivedPenalty: Number(recordWaived || 0),
        notes: recordNotes,
        userName: loan.fullName || 'Borrower',
        userPhone: loan.userPhone || '',
        collectedBy: 'admin@gmail.com',
        paidAt: now.toISOString(),
        status: 'verified',
        isFinalSettlement,
      };

      await addDoc(collection(db, 'applications', loan.id, 'repayments'), repaymentRecord);
      await addDoc(collection(db, 'repayments'), repaymentRecord);
      await updateDoc(doc(db, 'applications', loan.id), updateData);
    } catch (e) {
      console.warn("Record payment fallback:", e);
    }

    setApplications(prev => prev.map(a => a.id === loan.id ? { ...a, ...updateData } : a));
    setRecordingLoan(null);
    alert(`✓ Payment of ₹${recordAmount.toLocaleString('en-IN')} recorded successfully! App has been updated in real-time.`);
  };

  // 5. Waive Penalty Action
  const openWaiveModal = (loan: any) => {
    const metrics = computeLoanCollectionMetrics(loan);
    setWaivingLoan(loan);
    setWaiveAmount(metrics.penalty);
  };

  const submitWaivePenalty = async () => {
    if (!waivingLoan) return;
    const loan = waivingLoan;
    const newWaived = (Number(loan.penaltyWaived) || 0) + Number(waiveAmount);

    try {
      await updateDoc(doc(db, 'applications', loan.id), {
        penaltyWaived: newWaived,
      });
    } catch (e) {
      console.warn("Waive penalty error:", e);
    }

    setApplications(prev => prev.map(a => a.id === loan.id ? { ...a, penaltyWaived: newWaived } : a));
    setWaivingLoan(null);
    alert(`✓ ₹${waiveAmount.toLocaleString('en-IN')} penalty waived successfully.`);
  };

  // 6. WhatsApp Reminder Sender
  const sendWhatsAppReminder = (loan: any) => {
    const metrics = computeLoanCollectionMetrics(loan);
    const phone = (loan.userPhone || loan.phone || '').replace(/\D/g, '');
    if (!phone) {
      alert("No valid phone number for this borrower.");
      return;
    }

    const cleanPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const name = loan.fullName || 'Borrower';
    const loanId = loan.id.substring(0, 8);
    const emi = Number(loan.monthlyEmi).toLocaleString('en-IN');
    const total = metrics.totalDue.toLocaleString('en-IN');
    const dueDate = metrics.dueDateFormatted;

    let overdueText = '';
    if (metrics.isOverdue) {
      overdueText = `\n⚠️ *STATUS: OVERDUE BY ${metrics.overdueDays} DAYS*\n• Late Penalty (@ ₹100/day): ₹${metrics.penalty.toLocaleString('en-IN')}`;
    }

    const message = `Namaste ${name},\n\nThis is an automated repayment alert from *Loan Bazar* for your Loan Account #${loanId}.\n\n📊 *Repayment Breakdown:*\n• Sanctioned Principal: ₹${Number(loan.amount).toLocaleString('en-IN')}\n• EMI Due Date: ${dueDate}\n• Base EMI Amount: ₹${emi}${overdueText}\n• *Total Amount Payable: ₹${total}*\n\n⚠️ *Note:* As per policy, late penalty of ₹100 per day is charged for delayed payments.\n\n📲 *How to Repay:*\nPlease open your *Loan Bazar mobile app* or scan the official Loan Bazar UPI QR Code to pay ₹${total}.\nUpload your payment screenshot & UTR in the app for instant automated verification.\n\nRegards,\n*Loan Bazar Credit & Collections Team*\n📞 +91 9016131681`;

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Global User Block/Unblock
  const toggleBlockUser = async (phone: string, currentStatus: boolean) => {
    const action = currentStatus ? "Unblock" : "Block";
    if (!window.confirm(`Are you sure you want to ${action} user with phone ${phone}?`)) return;

    try {
      await setDoc(doc(db, 'users', phone), { isBlocked: !currentStatus }, { merge: true });

      const q = query(collection(db, 'applications'), where('userPhone', '==', phone));
      const snaps = await getDocs(q);
      if (!snaps.empty) {
        const batch = writeBatch(db);
        snaps.docs.forEach(d => {
          batch.update(d.ref, { isBlocked: !currentStatus });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Toggle block user error: ", e);
    }
    setRegisteredUsers(prev => prev.map(u => (u.phone === phone || u.id === phone) ? { ...u, isBlocked: !currentStatus } : u));
    setApplications(prev => prev.map(a => a.userPhone === phone ? { ...a, isBlocked: !currentStatus } : a));
    if (detailedApp?.userPhone === phone) setDetailedApp((prev: any) => ({ ...prev, isBlocked: !currentStatus }));
  };

  const deleteApplication = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this application record?")) return;
    try {
      await deleteDoc(doc(db, 'applications', id));
    } catch {
      // Local fallback
    }
    setApplications(prev => prev.filter(a => a.id !== id));
    if (detailedApp?.id === id) setDetailedApp(null);
  };

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Merge Registered Users and Loan Applicants
  const usersMap = new Map<string, any>();
  registeredUsers.forEach(u => {
    const key = (u.phone || u.id || u.email || '').toString().trim();
    if (!key) return;
    usersMap.set(key, {
      id: u.id || key,
      phone: u.phone || u.id || 'N/A',
      name: u.name || 'Registered Customer',
      email: u.email || 'N/A',
      photoUrl: u.photoUrl,
      aadhaar: u.aadhaar || 'Not Provided',
      pan: u.pan || 'Not Provided',
      employmentType: u.employmentType || 'Registered User',
      monthlyIncome: u.monthlyIncome || 0,
      bankName: u.bankName || 'Not Linked',
      accountNumber: u.accountNumber || '—',
      ifscCode: u.ifscCode || '—',
      totalLoans: 0,
      totalAmount: 0,
      latestStatus: 'Registered (No Loan Form)',
      isBlocked: u.isBlocked || false,
      panUrl: null,
      aadhaarUrl: null,
      incomeProofUrl: null,
      selfieUrl: u.photoUrl || null,
      housePhotoUrl: null,
      appsList: []
    });
  });

  applications.forEach(app => {
    const key = (app.userPhone || app.phone || app.fullName || app.id || '').toString().trim();
    if (!usersMap.has(key)) {
      usersMap.set(key, {
        id: app.id,
        phone: app.userPhone || app.phone || 'N/A',
        name: app.fullName || 'N/A',
        email: app.userEmail || 'N/A',
        photoUrl: app.selfieUrl,
        aadhaar: app.aadhaarNumber || 'N/A',
        pan: app.panNumber || 'N/A',
        employmentType: app.employmentType || 'salaried',
        monthlyIncome: app.monthlyIncome || 0,
        bankName: app.bankName || 'N/A',
        accountNumber: app.accountNumber || 'N/A',
        ifscCode: app.ifscCode || 'N/A',
        totalLoans: 1,
        totalAmount: app.amount || 0,
        latestStatus: app.status,
        isBlocked: app.isBlocked || false,
        panUrl: app.panUrl,
        aadhaarUrl: app.aadhaarUrl,
        incomeProofUrl: app.incomeProofUrl || app.proofUrl,
        bankStatementUrl: app.bankStatementUrl,
        selfieUrl: app.selfieUrl,
        housePhotoUrl: app.housePhotoUrl || app.homePhotoUrl,
        appsList: [app]
      });
    } else {
      const existing = usersMap.get(key);
      if (app.fullName && (existing.name === 'Registered Customer' || !existing.name)) existing.name = app.fullName;
      if (app.userEmail && existing.email === 'N/A') existing.email = app.userEmail;
      if (app.selfieUrl) existing.selfieUrl = app.selfieUrl;
      if (app.housePhotoUrl || app.homePhotoUrl) existing.housePhotoUrl = app.housePhotoUrl || app.homePhotoUrl;
      if (app.panNumber) existing.pan = app.panNumber;
      if (app.aadhaarNumber) existing.aadhaar = app.aadhaarNumber;
      if (app.panUrl) existing.panUrl = app.panUrl;
      if (app.aadhaarUrl) existing.aadhaarUrl = app.aadhaarUrl;
      if (app.incomeProofUrl || app.proofUrl) existing.incomeProofUrl = app.incomeProofUrl || app.proofUrl;
      if (app.bankName) existing.bankName = app.bankName;
      if (app.accountNumber) existing.accountNumber = app.accountNumber;
      if (app.ifscCode) existing.ifscCode = app.ifscCode;
      existing.totalLoans += 1;
      existing.totalAmount += (app.amount || 0);
      existing.latestStatus = app.status;
      existing.appsList.push(app);
      if (app.isBlocked) existing.isBlocked = true;
    }
  });
  const usersList = Array.from(usersMap.values());

  // Filtered lists
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.userPhone || '').includes(searchQuery) ||
      (app.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.panNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.aadhaarNumber || '').includes(searchQuery) ||
      (app.bankName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.accountNumber || '').includes(searchQuery) ||
      (app.razorpayPaymentId || '').includes(searchQuery) ||
      (app.acceptancePaymentId || '').includes(searchQuery);

    const matchesStatus = statusFilter === 'all' ||
      app.status === statusFilter ||
      (statusFilter === 'acceptance_done' && (app.status === 'acceptance_done' || app.status === 'autopay_done'));

    return matchesSearch && matchesStatus;
  });

  const filteredUsers = usersList.filter(u => {
    const matchesSearch =
      (u.name || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.phone || '').includes(userSearchQuery) ||
      (u.email || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.pan || '').toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (u.aadhaar || '').includes(userSearchQuery);

    const matchesFilter = userFilter === 'all' ||
      (userFilter === 'active' && !u.isBlocked) ||
      (userFilter === 'blocked' && u.isBlocked);

    return matchesSearch && matchesFilter;
  });

  // Collection List (Disbursed & Repaid loans)
  const collectionList = applications
    .filter(a => a.status === 'disbursed' || a.status === 'repaid')
    .map(a => {
      const metrics = computeLoanCollectionMetrics(a);
      return { ...a, ...metrics };
    })
    .filter(a => {
      const matchesSearch =
        (a.fullName || '').toLowerCase().includes(collectionSearch.toLowerCase()) ||
        (a.userPhone || '').includes(collectionSearch) ||
        (a.id || '').includes(collectionSearch) ||
        (a.panNumber || '').toLowerCase().includes(collectionSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (collectionFilter === 'overdue') return a.status === 'disbursed' && a.isOverdue;
      if (collectionFilter === 'due_soon') return a.status === 'disbursed' && !a.isOverdue;
      if (collectionFilter === 'repaid') return a.status === 'repaid';
      return true;
    });

  // Collection Aggregate KPIs
  const activeDisbursedLoans = applications.filter(a => a.status === 'disbursed');
  const totalBaseEmiDue = activeDisbursedLoans.reduce((sum, a) => sum + (Number(a.monthlyEmi) || 0), 0);
  const totalAccruedPenalties = activeDisbursedLoans.reduce((sum, a) => sum + computeLoanCollectionMetrics(a).penalty, 0);
  const totalCollectibleAmount = totalBaseEmiDue + totalAccruedPenalties;
  const totalSettledCapital = applications.filter(a => a.status === 'repaid').reduce((sum, a) => sum + (Number(a.totalRepayment) || Number(a.amount) || 0), 0);
  const overdueCount = activeDisbursedLoans.filter(a => computeLoanCollectionMetrics(a).isOverdue).length;

  if (!isAuthenticated) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '36px',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <img
              src="/logo.svg"
              alt="Logo"
              style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', borderRadius: '10px' }}
            />
            <h2 style={{ margin: 0, color: '#0F172A', fontSize: '22px', fontWeight: 700 }}>Loan Bazar Admin</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748B', fontSize: '13px' }}>Master Underwriting & Collection Portal</p>
          </div>

          {authError && (
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              color: '#DC2626',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Admin Email
              </label>
              <input
                type="email"
                required
                placeholder="admin@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                required
                placeholder="••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#1E3A8A',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Log In to Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 30px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
      {/* Top Header */}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/logo.svg"
              alt="Logo"
              style={{ width: '38px', height: '38px', borderRadius: '8px' }}
            />
            <h1 style={{ margin: 0, color: '#0F172A', fontSize: '24px', fontWeight: 700 }}>Loan Bazar - Master Admin Portal</h1>
          </div>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Underwriting, ₹1 Acceptance Verification, Disbursals & Automated EMI Recovery System</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSelectedDoc({ title: 'Loan Bazar Official Payment QR Scanner', url: '/loanbazarscanner.jpeg' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#EFF6FF',
              color: '#1D4ED8',
              border: '1px solid #BFDBFE',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            📲 Loan Bazar QR Scanner 🔍
          </button>
          <div style={{ background: '#E2E8F0', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#334155', fontWeight: 500 }}>
            👤 admin@gmail.com
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Primary Navigation View Switcher (3 Tabs) */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveView('applications')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeView === 'applications' ? '#1E3A8A' : '#FFFFFF',
            color: activeView === 'applications' ? '#FFFFFF' : '#475569',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          📋 Loan Applications ({applications.length})
        </button>

        <button
          onClick={() => setActiveView('collections')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeView === 'collections' ? '#047857' : '#FFFFFF',
            color: activeView === 'collections' ? '#FFFFFF' : '#475569',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          💰 EMI Collection & Recoveries ({activeDisbursedLoans.length} Active{overdueCount > 0 ? ` • ${overdueCount} Overdue` : ''})
        </button>

        <button
          onClick={() => setActiveView('users')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: activeView === 'users' ? '#1E3A8A' : '#FFFFFF',
            color: activeView === 'users' ? '#FFFFFF' : '#475569',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          👥 User Directory & Customers ({usersList.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LOAN APPLICATIONS VIEW */}
      {/* ========================================================================= */}
      {activeView === 'applications' && (
        <>
          {/* Stats KPI Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Applications</div>
              <div style={{ color: '#0F172A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{applications.length}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Under Review (Pending)</div>
              <div style={{ color: '#F59E0B', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {applications.filter(a => a.status === 'under_review').length}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>₹1 Verified (Ready to Disburse)</div>
              <div style={{ color: '#3B82F6', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {applications.filter(a => a.status === 'acceptance_done' || a.status === 'autopay_done').length}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Disbursed Capital</div>
              <div style={{ color: '#10B981', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                ₹{applications.filter(a => a.status === 'disbursed').reduce((s, a) => s + (a.amount || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'under_review', label: 'Under Review' },
                { id: 'approved', label: 'Approved (Waiting ₹1)' },
                { id: 'acceptance_submitted', label: `⚡ ₹1 Pending Review (${applications.filter(a => a.status === 'acceptance_submitted').length})` },
                { id: 'acceptance_done', label: '₹1 Verified (Disburse)' },
                { id: 'disbursed', label: 'Disbursed' },
                { id: 'rejected', label: 'Rejected' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: statusFilter === tab.id ? (tab.id === 'acceptance_submitted' ? '#D97706' : '#1E3A8A') : '#FFFFFF',
                    color: statusFilter === tab.id ? '#FFFFFF' : '#475569',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Search name, phone, PAN, Bank A/C..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  width: '320px',
                  outline: 'none',
                  background: '#FFFFFF'
                }}
              />
            </div>
          </div>

          {/* Applications Table */}
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
            <table border={0} cellPadding={12} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th>Applicant & KYC</th>
                  <th>Employment & Income</th>
                  <th>Loan & EMI</th>
                  <th>Disbursal Bank Details</th>
                  <th>Documents</th>
                  <th>Status & ₹1 Fee</th>
                  <th>Admin Action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      No applications found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app) => {
                    const appRate = adminRates[app.id] !== undefined ? adminRates[app.id] : (Number(app.interestRate) || 14.0);
                    const calc = calculateAdminLoan(app.amount, appRate, app.tenureMonths, app.tenureDays);
                    const isAccepted = app.status === 'acceptance_done' || app.status === 'autopay_done';

                    return (
                      <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9', background: app.isBlocked ? '#fef2f2' : (app.status === 'acceptance_submitted' ? '#fffbeb' : 'transparent') }}>
                        {/* Applicant & KYC */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            {app.selfieUrl ? (
                              <img
                                src={app.selfieUrl}
                                alt="Selfie"
                                onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${app.fullName}`, url: app.selfieUrl })}
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb', cursor: 'pointer' }}
                                title="Click to view full selfie"
                              />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F59E0B', color: '#0F172A', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                                {(app.fullName || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <strong style={{ color: '#0F172A', fontSize: '14px' }}>{app.fullName || 'N/A'}</strong>
                            </div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>📱 {app.userPhone || 'N/A'}</span><br />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>✉️ {app.userEmail || 'N/A'}</span><br />
                          <span style={{ fontSize: '11px', color: '#334155' }}>
                            <b>PAN:</b> <code>{app.panNumber || 'N/A'}</code> | <b>Aadhaar:</b> <code>{app.aadhaarNumber || 'N/A'}</code>
                          </span>
                        </td>

                        {/* Employment & Income */}
                        <td>
                          <span style={{ textTransform: 'capitalize', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500 }}>
                            {app.employmentType || 'Salaried'}
                          </span>
                          <div style={{ fontSize: '12px', color: '#334155', marginTop: '4px' }}>
                            Income: <b>₹{(app.monthlyIncome || 0).toLocaleString('en-IN')}/mo</b>
                          </div>
                        </td>

                        {/* Loan & EMI */}
                        <td>
                          <strong style={{ color: '#0F172A', fontSize: '15px' }}>₹{Number(app.amount || 0).toLocaleString('en-IN')}</strong><br />
                          <span style={{ fontSize: '12px', color: '#1E3A8A', fontWeight: 700 }}>{calc.isDays ? 'Bullet Due' : 'Monthly EMI'}: ₹{calc.emi.toLocaleString('en-IN')}{calc.isDays ? '' : '/mo'}</span><br />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{calc.tenureDisplay} @ {appRate}% p.a.</span>
                        </td>

                        {/* Disbursal Bank Details */}
                        <td>
                          <div style={{ background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                            <strong style={{ color: '#0F172A', fontSize: '12px' }}>{app.bankName || 'Bank Name Not Specified'}</strong><br />
                            <span style={{ fontSize: '12px', color: '#334155' }}>A/C: <code>{app.accountNumber || '—'}</code></span><br />
                            <span style={{ fontSize: '11px', color: '#64748b' }}>IFSC: <code>{app.ifscCode || '—'}</code></span>
                          </div>
                        </td>

                        {/* All Documents Section */}
                        <td>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', minWidth: '160px' }}>
                            <button
                              onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${app.fullName}`, url: app.selfieUrl || '' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: app.selfieUrl ? '#eff6ff' : '#F1F5F9', border: '1px solid ' + (app.selfieUrl ? '#93c5fd' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: app.selfieUrl ? '#1d4ed8' : '#334155' }}>
                              📸 Selfie
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `House Photo - ${app.fullName}`, url: app.housePhotoUrl || app.homePhotoUrl || '' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: (app.housePhotoUrl || app.homePhotoUrl) ? '#f0fdf4' : '#F1F5F9', border: '1px solid ' + ((app.housePhotoUrl || app.homePhotoUrl) ? '#86efac' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: (app.housePhotoUrl || app.homePhotoUrl) ? '#15803d' : '#334155' }}>
                              🏠 House
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `PAN Card - ${app.fullName}`, url: app.panUrl || '' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px' }}>
                              📄 PAN
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `Aadhaar Card - ${app.fullName}`, url: app.aadhaarUrl || '' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px' }}>
                              🆔 Aadhaar
                            </button>
                            {app.acceptanceScreenshotUrl && (
                              <button
                                onClick={() => setSelectedDoc({ title: `₹1 Acceptance Payment Proof - ${app.fullName}`, url: app.acceptanceScreenshotUrl })}
                                style={{ padding: '4px 6px', cursor: 'pointer', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#B45309' }}>
                                🧾 ₹1 Proof
                              </button>
                            )}
                            {app.pendingEmiScreenshotUrl && (
                              <button
                                onClick={() => setSelectedDoc({ title: `EMI Payment Proof - ${app.fullName}`, url: app.pendingEmiScreenshotUrl })}
                                style={{ padding: '4px 6px', cursor: 'pointer', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: '#1D4ED8' }}>
                                🧾 EMI Proof
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Status & ₹1 Acceptance */}
                        <td>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            display: 'inline-block',
                            marginBottom: '4px',
                            background: app.status === 'disbursed' ? '#dcfce7' : isAccepted ? '#e0f2fe' : app.status === 'acceptance_submitted' ? '#fef3c7' : app.status === 'approved' ? '#fef9c3' : app.status === 'rejected' ? '#fee2e2' : '#fffbeb',
                            color: app.status === 'disbursed' ? '#15803d' : isAccepted ? '#0369a1' : app.status === 'acceptance_submitted' ? '#d97706' : app.status === 'approved' ? '#a16207' : app.status === 'rejected' ? '#b91c1c' : '#b45309'
                          }}>
                            {app.status === 'under_review' && '⏳ Under Review'}
                            {app.status === 'approved' && '✓ Approved (Waiting ₹1)'}
                            {app.status === 'acceptance_submitted' && '⚡ ₹1 Paid (Needs Review)'}
                            {isAccepted && '⚡ ₹1 Verified (Accepted)'}
                            {app.status === 'disbursed' && '💰 Disbursed (Active)'}
                            {app.status === 'repaid' && '✓ Repaid & Closed'}
                            {app.status === 'rejected' && '✕ Rejected'}
                          </span>
                          {(app.acceptancePaymentId || app.razorpayPaymentId) && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              UTR: <code style={{ fontWeight: 700, color: '#1E3A8A' }}>{app.acceptancePaymentId || app.razorpayPaymentId}</code>
                            </div>
                          )}
                        </td>

                        {/* Admin Strict Action */}
                        <td style={{ minWidth: '200px' }}>
                          {app.status === 'under_review' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ background: '#F8FAFC', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>Admin Rate:</span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.5"
                                      value={appRate}
                                      onChange={(e) => setAdminRates(prev => ({ ...prev, [app.id]: parseFloat(e.target.value) || 0 }))}
                                      style={{ width: '54px', padding: '2px 4px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #94A3B8', borderRadius: '4px', textAlign: 'right', background: 'white' }}
                                    />
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#1E3A8A' }}>%</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                  {[5, 10, 14, 18, 24].map((r) => (
                                    <button
                                      key={r}
                                      onClick={() => setAdminRates(prev => ({ ...prev, [app.id]: r }))}
                                      style={{
                                        background: appRate === r ? '#1E3A8A' : '#E2E8F0',
                                        color: appRate === r ? 'white' : '#1E293B',
                                        border: 'none',
                                        padding: '1px 5px',
                                        borderRadius: '3px',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {r}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => handleApprove(app.id, app.fullName, app, appRate)}
                                style={{ background: '#16a34a', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                                ✓ Approve @ {appRate}%
                              </button>
                              <button
                                onClick={() => handleReject(app.id, app.fullName)}
                                style={{ background: '#dc2626', color: 'white', padding: '5px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}>
                                ✕ Decline / Reject
                              </button>
                            </div>
                          )}

                          {app.status === 'approved' && (
                            <div style={{ fontSize: '12px', color: '#0369A1', background: '#E0F2FE', padding: '8px', borderRadius: '6px', border: '1px solid #BAE6FD' }}>
                              <div style={{ fontWeight: 700, marginBottom: '2px' }}>✓ Approved @ {app.interestRate}%</div>
                              <div style={{ fontSize: '11px', color: '#0284C7' }}>Waiting for user to pay ₹1 & submit UTR</div>
                            </div>
                          )}

                          {app.status === 'acceptance_submitted' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#FFFBEB', padding: '8px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                              <div style={{ fontSize: '11px', color: '#92400E', fontWeight: 700 }}>
                                ⚡ User Paid ₹1 (Review UTR):
                              </div>
                              <div style={{ background: '#FFFFFF', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '12px' }}>
                                <span style={{ fontSize: '10px', color: '#64748B' }}>Submitted UTR:</span><br />
                                <code style={{ fontWeight: 800, color: '#1E3A8A', fontSize: '12px' }}>{app.acceptancePaymentId || app.razorpayPaymentId || 'N/A'}</code>
                              </div>
                              {app.acceptanceScreenshotUrl && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedDoc({ title: `₹1 Acceptance Payment Proof - ${app.fullName}`, url: app.acceptanceScreenshotUrl })}
                                  style={{ background: '#0284C7', color: 'white', padding: '6px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                  📸 View Screenshot Proof ↗
                                </button>
                              )}
                              <button
                                onClick={() => handleApproveAcceptance(app.id, app)}
                                style={{ background: '#16a34a', color: 'white', padding: '6px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '11px' }}>
                                ✓ Payment Received (Approve)
                              </button>
                              <button
                                onClick={() => handleRejectAcceptance(app.id, app)}
                                style={{ background: '#dc2626', color: 'white', padding: '5px 8px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}>
                                ✕ Reject ₹1 Payment
                              </button>
                            </div>
                          )}

                          {isAccepted && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '11px', color: '#047857', background: '#ECFDF5', padding: '4px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                                ⚡ ₹1 Verification Confirmed
                              </div>
                              <button
                                onClick={() => handleDisburse(app.id, app)}
                                style={{
                                  background: '#2563eb',
                                  color: 'white',
                                  padding: '8px 12px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  boxShadow: '0 2px 6px rgba(37,99,235,0.35)'
                                }}
                              >
                                💳 Disburse ₹{(Number(app.netDisbursalAmount) || Number(app.amount)).toLocaleString('en-IN')} to {app.bankName || 'Bank'}
                              </button>
                            </div>
                          )}

                          {app.status === 'disbursed' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>
                                ✓ Funds Disbursed
                              </div>
                              <button
                                onClick={() => {
                                  setActiveView('collections');
                                  setCollectionSearch(app.userPhone || app.fullName);
                                }}
                                style={{ background: '#047857', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                💰 Manage EMI Collection ↗
                              </button>
                            </div>
                          )}

                          {app.status === 'rejected' && (
                            <div style={{ color: '#dc2626', fontSize: '12px' }}>
                              Reason: {app.rejectionReason || 'Declined'}
                            </div>
                          )}
                        </td>

                        {/* More Options */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              onClick={() => setDetailedApp(app)}
                              style={{ background: '#1E293B', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>
                              👁️ Dossier
                            </button>
                            <button
                              onClick={() => toggleBlockUser(app.userPhone, app.isBlocked)}
                              style={{ background: app.isBlocked ? '#475569' : '#ea580c', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                              {app.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              onClick={() => deleteApplication(app.id)}
                              style={{ background: '#b91c1c', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEDICATED EMI COLLECTION & RECOVERIES PAGE */}
      {/* ========================================================================= */}
      {activeView === 'collections' && (
        <div>
          {/* Recovery Overview KPI Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Active Disbursed Loans</div>
              <div style={{ color: '#0F172A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{activeDisbursedLoans.length}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Base EMI Due Portfolio</div>
              <div style={{ color: '#1E3A8A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                ₹{totalBaseEmiDue.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: '#FEF2F2', padding: '16px 20px', borderRadius: '10px', border: '1px solid #FECACA', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#991B1B', fontSize: '13px', fontWeight: 600 }}>🚨 Overdue Penalties Accrued (@ ₹100/day)</div>
              <div style={{ color: '#DC2626', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                +₹{totalAccruedPenalties.toLocaleString('en-IN')}
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#B91C1C', marginLeft: '6px' }}>({overdueCount} Overdue)</span>
              </div>
            </div>
            <div style={{ background: '#F0FDF4', padding: '16px 20px', borderRadius: '10px', border: '1px solid #BBF7D0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#15803D', fontSize: '13px', fontWeight: 600 }}>Total Current Collectible</div>
              <div style={{ color: '#16A34A', fontSize: '24px', fontWeight: 800, marginTop: '4px' }}>
                ₹{totalCollectibleAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Settled / Repaid</div>
              <div style={{ color: '#047857', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                ₹{totalSettledCapital.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Pending Payment Approvals Queue (Action Required) */}
          {repaymentsList.filter(r => r.status === 'pending_verification').length > 0 && (
            <div style={{ background: '#FFFBEB', borderRadius: '12px', border: '2px solid #F59E0B', padding: '18px 20px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block', boxShadow: '0 0 8px #D97706' }}></span>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#92400E' }}>
                    🚨 Pending Payment Approvals ({repaymentsList.filter(r => r.status === 'pending_verification').length}) — Action Required
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: '#92400E', fontWeight: 700, background: '#FDE68A', padding: '4px 12px', borderRadius: '12px' }}>
                  Verify Received Payments in Bank / Razorpay
                </span>
              </div>
              <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                <table border={0} cellPadding={10} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#FEF3C7', color: '#78350F', borderBottom: '2px solid #FDE68A' }}>
                      <th>Submission Time</th>
                      <th>Borrower & Phone</th>
                      <th>Payment Type</th>
                      <th>Amount Received</th>
                      <th>Submitted UTR / Ref</th>
                      <th>Payment Proof</th>
                      <th style={{ textAlign: 'center' }}>Admin Action (Approve / Reject)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repaymentsList.filter(r => r.status === 'pending_verification').map((rep, idx) => (
                      <tr key={rep.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ color: '#64748B', fontSize: '12px' }}>
                          {rep.paidAt?.toDate ? rep.paidAt.toDate().toLocaleString('en-IN') : (rep.paidAt ? new Date(rep.paidAt).toLocaleString('en-IN') : 'Just now')}
                        </td>
                        <td>
                          <b>{rep.userName || 'Borrower'}</b><br />
                          <span style={{ fontSize: '11px', color: '#64748B' }}>📱 +91 {rep.userPhone}</span>
                        </td>
                        <td>
                          <span style={{ background: rep.type === 'acceptance_fee' ? '#E0F2FE' : '#ECFDF5', color: rep.type === 'acceptance_fee' ? '#0369A1' : '#047857', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '11px' }}>
                            {rep.type === 'acceptance_fee' ? '⚡ ₹1 Acceptance Fee' : `✓ EMI #${rep.emiNumber || 1} Repayment`}
                          </span>
                        </td>
                        <td>
                          <b style={{ color: '#059669', fontSize: '15px' }}>₹{Number(rep.amount).toLocaleString('en-IN')}</b>
                        </td>
                        <td>
                          <code style={{ fontWeight: 800, color: '#1E3A8A', background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #CBD5E1' }}>
                            {rep.paymentId}
                          </code>
                        </td>
                        <td>
                          {(() => {
                            const proofUrl = rep.screenshotUrl || (rep.type === 'acceptance_fee' ? applications.find(a => a.id === rep.applicationId)?.acceptanceScreenshotUrl : applications.find(a => a.id === rep.applicationId)?.pendingEmiScreenshotUrl);
                            if (proofUrl) {
                              return (
                                <button
                                  onClick={() => setSelectedDoc({ title: `Payment Screenshot - ${rep.userName || 'Borrower'} (UTR: ${rep.paymentId})`, url: proofUrl })}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: '#EFF6FF',
                                    border: '1px solid #93C5FD',
                                    color: '#1D4ED8',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  📸 View Screenshot
                                </button>
                              );
                            }
                            return <span style={{ color: '#94A3B8', fontSize: '11px' }}>No screenshot</span>;
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                            {rep.type === 'acceptance_fee' ? (
                              <>
                                <button
                                  onClick={() => handleApproveAcceptance(rep.applicationId, rep)}
                                  style={{ background: '#16A34A', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                                >
                                  ✓ Payment Received (Approve)
                                </button>
                                <button
                                  onClick={() => handleRejectAcceptance(rep.applicationId, rep)}
                                  style={{ background: '#DC2626', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                                >
                                  ✕ Reject
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApproveEmiRepayment(rep)}
                                  style={{ background: '#16A34A', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                                >
                                  ✓ Payment Received (Approve EMI)
                                </button>
                                <button
                                  onClick={() => handleRejectEmiRepayment(rep)}
                                  style={{ background: '#DC2626', color: 'white', padding: '6px 10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
                                >
                                  ✕ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Real-time Automated Repayments Live Feed Banner */}
          {repaymentsList.length > 0 && (
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #BBF7D0', padding: '18px 20px', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block', boxShadow: '0 0 8px #10B981' }}></span>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#065F46' }}>⚡ Repayment Records History & Audit Log</h3>
                </div>
                <span style={{ fontSize: '12px', color: '#047857', fontWeight: 600, background: '#DCFCE7', padding: '3px 10px', borderRadius: '12px' }}>
                  {repaymentsList.length} Payments Recorded
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table border={0} cellPadding={8} style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#F0FDF4', color: '#166534', borderBottom: '1px solid #DCFCE7' }}>
                      <th>Timestamp</th>
                      <th>Borrower & Phone</th>
                      <th>Payment Mode & UTR / Ref</th>
                      <th>Base EMI</th>
                      <th>Penalty Paid</th>
                      <th>Total Received</th>
                      <th>Verification Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repaymentsList.slice(0, 10).map((rep, idx) => (
                      <tr key={rep.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ color: '#64748B' }}>
                          {rep.paidAt?.toDate ? rep.paidAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rep.paidAt ? new Date(rep.paidAt).toLocaleTimeString('en-IN') : 'Just now')}
                        </td>
                        <td>
                          <b>{rep.userName || 'Borrower'}</b> (📱 {rep.userPhone})
                        </td>
                        <td>
                          <span style={{ textTransform: 'uppercase', background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {rep.paymentMode || rep.method || 'Razorpay'}
                          </span>{' '}
                          <code>{rep.paymentId}</code>
                        </td>
                        <td style={{ fontWeight: 600 }}>₹{Number(rep.baseEmi || rep.amount).toLocaleString('en-IN')}</td>
                        <td style={{ color: rep.penaltyPaid > 0 ? '#DC2626' : '#64748B', fontWeight: rep.penaltyPaid > 0 ? 700 : 400 }}>
                          {rep.penaltyPaid > 0 ? `+₹${Number(rep.penaltyPaid).toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        <td>
                          <b style={{ color: '#059669', fontSize: '13px' }}>₹{Number(rep.amount).toLocaleString('en-IN')}</b>
                        </td>
                        <td>
                          <span style={{
                            background: rep.status === 'pending_verification' ? '#FEF3C7' : rep.status === 'rejected' ? '#FEE2E2' : '#DCFCE7',
                            color: rep.status === 'pending_verification' ? '#D97706' : rep.status === 'rejected' ? '#DC2626' : '#15803D',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '11px'
                          }}>
                            {rep.status === 'pending_verification' ? '⏳ Pending Approval' : rep.status === 'rejected' ? `✕ Rejected: ${rep.rejectedReason || ''}` : (rep.isFinalSettlement ? '🏆 Loan Closed' : (rep.type === 'acceptance_fee' ? '⚡ ₹1 Verified' : `✓ EMI #${rep.emiNumber || 1} Verified`))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Collection Filter & Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Active Loans' },
                { id: 'overdue', label: `⚠️ Overdue (${overdueCount})` },
                { id: 'due_soon', label: '⏰ Due Today / On Track' },
                { id: 'repaid', label: '✅ Settled / Repaid' },
              ].map((tab: any) => (
                <button
                  key={tab.id}
                  onClick={() => setCollectionFilter(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: collectionFilter === tab.id ? (tab.id === 'overdue' ? '#DC2626' : '#047857') : '#FFFFFF',
                    color: collectionFilter === tab.id ? '#FFFFFF' : '#475569',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Search collection by borrower name, phone, PAN..."
                value={collectionSearch}
                onChange={(e) => setCollectionSearch(e.target.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  width: '360px',
                  outline: 'none',
                  background: '#FFFFFF',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              />
            </div>
          </div>

          {/* Collections Table */}
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
            <table border={0} cellPadding={14} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th>Borrower Profile</th>
                  <th>Loan & Disbursal Date</th>
                  <th>EMI Due Date & Days</th>
                  <th>Base EMI</th>
                  <th>Accrued Penalty (@ ₹100/day)</th>
                  <th>Total Due Amount</th>
                  <th>Status</th>
                  <th>Collection Actions</th>
                </tr>
              </thead>
              <tbody>
                {collectionList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      No active loan collections found for this filter.
                    </td>
                  </tr>
                ) : (
                  collectionList.map((loan) => {
                    const isOverdue = loan.isOverdue;
                    return (
                      <tr key={loan.id} style={{ borderBottom: '1px solid #f1f5f9', background: isOverdue ? '#fff5f5' : 'transparent' }}>
                        {/* Borrower Profile */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {loan.selfieUrl ? (
                              <img
                                src={loan.selfieUrl}
                                alt="Selfie"
                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb' }}
                              />
                            ) : (
                              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1E3A8A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                {(loan.fullName || 'U')[0].toUpperCase()}
                              </div>
                            )}
                            <div>
                              <strong style={{ color: '#0F172A', fontSize: '14px' }}>{loan.fullName}</strong><br />
                              <span style={{ fontSize: '12px', color: '#475569' }}>📱 +91 {loan.userPhone}</span><br />
                              <span style={{ fontSize: '11px', color: '#64748B' }}>PAN: <code>{loan.panNumber || '—'}</code></span>
                            </div>
                          </div>
                        </td>

                        {/* Loan & Disbursal */}
                        <td>
                          <strong style={{ color: '#0F172A', fontSize: '14px' }}>₹{Number(loan.amount).toLocaleString('en-IN')}</strong><br />
                          <span style={{ fontSize: '11px', color: '#64748B' }}>{loan.tenureDisplay || `${loan.tenureMonths} Mos`} @ {loan.interestRate}%</span><br />
                          <span style={{ fontSize: '11px', color: '#047857' }}>Disbursed: {loan.disbursedAt ? new Date(loan.disbursedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span>
                        </td>

                        {/* Due Date & Overdue Days */}
                        <td>
                          <div style={{ fontWeight: 700, color: isOverdue ? '#DC2626' : '#0F172A' }}>
                            {loan.dueDateFormatted}
                          </div>
                          {isOverdue ? (
                            <span style={{ display: 'inline-block', background: '#FEE2E2', color: '#DC2626', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                              ⚠️ {loan.overdueDays} Days Overdue
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>
                              {loan.statusLabel}
                            </span>
                          )}
                        </td>

                        {/* Base EMI */}
                        <td>
                          <span style={{ fontWeight: 600, color: '#334155' }}>
                            ₹{Number(loan.monthlyEmi).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Accrued Penalty */}
                        <td>
                          {loan.penalty > 0 ? (
                            <div>
                              <strong style={{ color: '#DC2626', fontSize: '14px' }}>+₹{loan.penalty.toLocaleString('en-IN')}</strong><br />
                              <span style={{ fontSize: '10px', color: '#991B1B' }}>({loan.overdueDays}d × ₹100/day)</span>
                            </div>
                          ) : (
                            <span style={{ color: '#16A34A', fontSize: '12px', fontWeight: 500 }}>₹0 (On Time)</span>
                          )}
                        </td>

                        {/* Total Due Amount */}
                        <td>
                          <strong style={{ color: isOverdue ? '#DC2626' : '#047857', fontSize: '16px' }}>
                            ₹{loan.totalDue.toLocaleString('en-IN')}
                          </strong>
                          {loan.status === 'repaid' && (
                            <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>✓ Settled</div>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: isOverdue ? '#FEE2E2' : (loan.status === 'repaid' ? '#DCFCE7' : '#EFF6FF'),
                            color: isOverdue ? '#DC2626' : (loan.status === 'repaid' ? '#15803D' : '#1D4ED8')
                          }}>
                            {isOverdue ? '⚠️ Overdue' : (loan.status === 'repaid' ? '✅ Paid' : '⚡ Due Soon')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '160px' }}>
                            {loan.status === 'disbursed' && (
                              <button
                                onClick={() => openRecordModal(loan)}
                                style={{
                                  background: '#047857',
                                  color: 'white',
                                  padding: '6px 10px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                }}
                              >
                                💰 Record Collection
                              </button>
                            )}

                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => sendWhatsAppReminder(loan)}
                                style={{
                                  flex: 1,
                                  background: '#25D366',
                                  color: 'white',
                                  padding: '5px 8px',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '2px'
                                }}
                                title="Send pre-filled WhatsApp EMI reminder with payment link"
                              >
                                💬 WhatsApp
                              </button>

                              <a
                                href={`tel:${loan.userPhone}`}
                                style={{
                                  background: '#1E3A8A',
                                  color: 'white',
                                  padding: '5px 8px',
                                  borderRadius: '4px',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Call Borrower"
                              >
                                📞
                              </a>

                              {isOverdue && (
                                <button
                                  onClick={() => openWaiveModal(loan)}
                                  style={{
                                    background: '#F1F5F9',
                                    color: '#334155',
                                    border: '1px solid #CBD5E1',
                                    padding: '5px 6px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600
                                  }}
                                  title="Waive Late Penalty Fee"
                                >
                                  ⚖️ Waive
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ALL USERS DIRECTORY & MANAGEMENT */}
      {/* ========================================================================= */}
      {activeView === 'users' && (
        <div>
          {/* User Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Registered Users</div>
              <div style={{ color: '#0F172A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{usersList.length}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Active Borrowers</div>
              <div style={{ color: '#16A34A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {usersList.filter(u => !u.isBlocked).length}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Blocked Accounts</div>
              <div style={{ color: '#DC2626', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {usersList.filter(u => u.isBlocked).length}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Borrowed Volume</div>
              <div style={{ color: '#2563EB', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                ₹{usersList.reduce((acc, u) => acc + u.totalAmount, 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* User Search & Filter Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['all', 'active', 'blocked'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setUserFilter(filter)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: userFilter === filter ? '#1E3A8A' : '#FFFFFF',
                    color: userFilter === filter ? '#FFFFFF' : '#475569',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    textTransform: 'capitalize'
                  }}
                >
                  {filter} Users
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Search users by name, phone, PAN, Aadhaar..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '13px',
                  width: '380px',
                  outline: 'none',
                  background: '#FFFFFF',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
              />
            </div>
          </div>

          {/* Users Table */}
          <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #E2E8F0' }}>
            <table border={0} cellPadding={14} style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                  <th>User Profile & KYC</th>
                  <th>Contact Info</th>
                  <th>Bank Account Details</th>
                  <th>Total Loan History</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                      No users found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: user.isBlocked ? '#fef2f2' : 'transparent' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {user.photoUrl || user.selfieUrl ? (
                            <img
                              src={user.photoUrl || user.selfieUrl}
                              alt="Selfie"
                              onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${user.name}`, url: user.photoUrl || user.selfieUrl })}
                              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb', cursor: 'pointer' }}
                              title="Click to view full selfie"
                            />
                          ) : (
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              backgroundColor: '#EFF6FF',
                              color: '#1E3A8A',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '16px'
                            }}>
                              {(user.name || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <strong style={{ color: '#0F172A', fontSize: '14px' }}>{user.name}</strong><br />
                            <span style={{ fontSize: '11px', color: '#64748B' }}>PAN: <code>{user.pan}</code> | Aadhaar: <code>{user.aadhaar}</code></span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>📱 {user.phone}</span><br />
                        <span style={{ fontSize: '12px', color: '#64748B' }}>✉️ {user.email}</span>
                      </td>
                      <td>
                        <div style={{ background: '#F8FAFC', padding: '6px 10px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          <strong>{user.bankName}</strong><br />
                          <span>A/C: <code>{user.accountNumber}</code></span><br />
                          <span>IFSC: <code>{user.ifscCode}</code></span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ color: '#0F172A', fontSize: '14px' }}>₹{user.totalAmount.toLocaleString('en-IN')}</strong><br />
                        <span style={{ fontSize: '12px', color: '#64748B' }}>{user.totalLoans} Application(s)</span>
                      </td>
                      <td>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', minWidth: '160px' }}>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'Live Selfie - ' + user.name, url: user.photoUrl || user.selfieUrl || '' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: (user.photoUrl || user.selfieUrl) ? '#eff6ff' : '#F1F5F9', border: '1px solid ' + ((user.photoUrl || user.selfieUrl) ? '#93c5fd' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: (user.photoUrl || user.selfieUrl) ? 600 : 400, color: (user.photoUrl || user.selfieUrl) ? '#1d4ed8' : '#334155' }}>
                            📸 Selfie
                          </button>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'House Photo - ' + user.name, url: user.housePhotoUrl || '' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: user.housePhotoUrl ? '#f0fdf4' : '#F1F5F9', border: '1px solid ' + (user.housePhotoUrl ? '#86efac' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: user.housePhotoUrl ? 600 : 400, color: user.housePhotoUrl ? '#15803d' : '#334155' }}>
                            🏠 House
                          </button>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: user.isBlocked ? '#FEE2E2' : '#DCFCE7',
                          color: user.isBlocked ? '#DC2626' : '#15803D'
                        }}>
                          {user.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button 
                          onClick={() => toggleBlockUser(user.phone, user.isBlocked)}
                          style={{
                            background: user.isBlocked ? '#16A34A' : '#EA580C',
                            color: 'white',
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600
                          }}
                        >
                          {user.isBlocked ? 'Unblock User' : 'Block User'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD COLLECTION PAYMENT */}
      {/* ========================================================================= */}
      {recordingLoan && (() => {
        const metrics = computeLoanCollectionMetrics(recordingLoan);
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '16px', maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#0F172A', fontSize: '18px' }}>💰 Record Collection Payment</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Borrower: <b>{recordingLoan.fullName}</b> (📱 +91 {recordingLoan.userPhone})</span>
                </div>
                <button onClick={() => setRecordingLoan(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}>✕</button>
              </div>

              {/* Dues Breakdown Info Box */}
              <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                  <span>Base Monthly EMI:</span>
                  <b>₹{Number(recordingLoan.monthlyEmi).toLocaleString('en-IN')}</b>
                </div>
                {metrics.isOverdue && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', color: '#DC2626' }}>
                    <span>Accrued Penalty ({metrics.overdueDays} days @ ₹100/day):</span>
                    <b>+₹{metrics.penalty.toLocaleString('en-IN')}</b>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '14px', fontWeight: 700, color: '#047857' }}>
                  <span>Total Calculated Due:</span>
                  <span>₹{metrics.totalDue.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment Entry Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Amount Collected (₹) *
                  </label>
                  <input
                    type="number"
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '14px', fontWeight: 'bold', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment Mode
                  </label>
                  <select
                    value={recordMode}
                    onChange={(e) => setRecordMode(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="upi_qr">LoanBazar QR Scanner (UPI)</option>
                    <option value="upi">UPI App (GPay / PhonePe / Paytm)</option>
                    <option value="bank_transfer">Direct Bank Transfer (IMPS/NEFT)</option>
                    <option value="cash">Cash Collection</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Payment ID / UTR / Reference No. *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. pay_Nxz8912 or 12-digit bank UTR"
                    value={recordUtr}
                    onChange={(e) => setRecordUtr(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                {metrics.isOverdue && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                      Penalty Discount / Waived Amount (₹ if any)
                    </label>
                    <input
                      type="number"
                      value={recordWaived}
                      onChange={(e) => setRecordWaived(Number(e.target.value))}
                      placeholder="0"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Remarks / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Verified in Razorpay / bank account"
                    value={recordNotes}
                    onChange={(e) => setRecordNotes(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <button
                  onClick={() => setRecordingLoan(null)}
                  style={{ padding: '8px 16px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitRecordCollection}
                  style={{ padding: '8px 20px', background: '#047857', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
                >
                  ✓ Confirm & Mark Paid
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 2: WAIVE PENALTY */}
      {/* ========================================================================= */}
      {waivingLoan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px' }}>⚖️ Waive Overdue Penalty</h3>
            <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '13px' }}>
              Borrower: <b>{waivingLoan.fullName}</b>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Penalty Amount to Waive (₹)
              </label>
              <input
                type="number"
                value={waiveAmount}
                onChange={(e) => setWaiveAmount(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '15px', fontWeight: 'bold', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setWaivingLoan(null)}
                style={{ padding: '8px 16px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={submitWaivePenalty}
                style={{ padding: '8px 18px', background: '#1E3A8A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
              >
                Confirm Waiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DOSSIER MODAL */}
      {/* ========================================================================= */}
      {detailedApp && (() => {
        const modalRate = adminRates[detailedApp.id] !== undefined ? adminRates[detailedApp.id] : (Number(detailedApp.interestRate) || 14.0);
        const modalCalc = calculateAdminLoan(detailedApp.amount, modalRate, detailedApp.tenureMonths, detailedApp.tenureDays);
        const isAccepted = detailedApp.status === 'acceptance_done' || detailedApp.status === 'autopay_done';

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '16px', maxWidth: '840px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#0F172A', fontSize: '20px' }}>Applicant Dossier: {detailedApp.fullName}</h2>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>Application Ref: #{detailedApp.id} • Tenure: <b>{modalCalc.tenureDisplay}</b></span>
                </div>
                <button onClick={() => setDetailedApp(null)} style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748B' }}>✕</button>
              </div>

              {/* Admin Interest Rate Setter & Live Calculation Box */}
              {detailedApp.status === 'under_review' && (
                <div style={{ background: '#F0FDF4', padding: '16px', borderRadius: '12px', border: '1px solid #86EFAC', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ color: '#15803D', fontSize: '14px' }}>🎯 Set Approved Interest Rate (%) for this Application:</strong>
                      <div style={{ fontSize: '12px', color: '#166534' }}>Customize interest rate before approving. User will see the breakdown based on this rate.</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        step="0.5"
                        value={modalRate}
                        onChange={(e) => setAdminRates(prev => ({ ...prev, [detailedApp.id]: parseFloat(e.target.value) || 0 }))}
                        style={{ width: '70px', padding: '6px 8px', fontSize: '15px', fontWeight: 'bold', border: '2px solid #16A34A', borderRadius: '6px', textAlign: 'right', background: 'white' }}
                      />
                      <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#15803D' }}>% p.a.</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>Quick Rates:</span>
                    {[7, 10, 12, 14, 18, 24].map((r) => (
                      <button
                        key={r}
                        onClick={() => setAdminRates(prev => ({ ...prev, [detailedApp.id]: r }))}
                        style={{
                          background: modalRate === r ? '#15803D' : '#DCFCE7',
                          color: modalRate === r ? 'white' : '#166534',
                          border: '1px solid #86EFAC',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#1E3A8A' }}>Sanctioned Loan</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#1E3A8A' }}>₹{Number(detailedApp.amount || 0).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: '#F0FDF4', padding: '12px', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                  <div style={{ fontSize: '11px', color: '#15803D' }}>Total Repayment</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#15803D' }}>₹{modalCalc.totalRepayment.toLocaleString('en-IN')}</div>
                </div>
                <div style={{ background: '#EFF6FF', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#1E3A8A' }}>{modalCalc.isDays ? 'Bullet Due' : 'Monthly EMI'}</div>
                  <div style={{ fontSize: '17px', fontWeight: 700, color: '#1E3A8A' }}>₹{modalCalc.emi.toLocaleString('en-IN')}{modalCalc.isDays ? '' : '/mo'}</div>
                </div>
              </div>

              {/* Profile & Disbursal Bank Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0F172A' }}>Applicant KYC & Contact</h4>
                  <div style={{ marginBottom: '4px' }}><b>Mobile:</b> +91 {detailedApp.userPhone}</div>
                  <div style={{ marginBottom: '4px' }}><b>Email:</b> {detailedApp.userEmail || 'N/A'}</div>
                  <div style={{ marginBottom: '4px' }}><b>Aadhaar:</b> <code>{detailedApp.aadhaarNumber || 'N/A'}</code></div>
                  <div style={{ marginBottom: '4px' }}><b>PAN:</b> <code>{detailedApp.panNumber || 'N/A'}</code></div>
                  <div><b>Employment:</b> {detailedApp.employmentType} (₹{detailedApp.monthlyIncome?.toLocaleString('en-IN')}/mo)</div>
                </div>

                <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0F172A' }}>Disbursal Bank Details</h4>
                  <div style={{ marginBottom: '4px' }}><b>Bank Name:</b> {detailedApp.bankName || 'N/A'}</div>
                  <div style={{ marginBottom: '4px' }}><b>Account No:</b> <code>{detailedApp.accountNumber || 'N/A'}</code></div>
                  <div style={{ marginBottom: '4px' }}><b>IFSC Code:</b> <code>{detailedApp.ifscCode || 'N/A'}</code></div>
                  <div style={{ marginBottom: '4px' }}><b>A/C Holder:</b> {detailedApp.accountHolderName || detailedApp.fullName}</div>
                  {(detailedApp.acceptancePaymentId || detailedApp.razorpayPaymentId) && (
                    <div style={{ marginTop: '6px', color: '#15803D' }}><b>₹1 Acceptance Verification Ref:</b> <code>{detailedApp.acceptancePaymentId || detailedApp.razorpayPaymentId}</code></div>
                  )}
                </div>
              </div>

              {/* Documents Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0F172A' }}>Uploaded KYC & Verification Documents</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  <button onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${detailedApp.fullName}`, url: detailedApp.selfieUrl || '' })} style={{ padding: '10px', background: detailedApp.selfieUrl ? '#EFF6FF' : '#F1F5F9', border: '1px solid ' + (detailedApp.selfieUrl ? '#93C5FD' : '#CBD5E1'), borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: detailedApp.selfieUrl ? 600 : 400, color: detailedApp.selfieUrl ? '#1E3A8A' : '#334155' }}>
                    📸 Live Selfie
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `House Photo - ${detailedApp.fullName}`, url: detailedApp.housePhotoUrl || detailedApp.homePhotoUrl || '' })} style={{ padding: '10px', background: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#F0FDF4' : '#F1F5F9', border: '1px solid ' + ((detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#86EFAC' : '#CBD5E1'), borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? 600 : 400, color: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#15803D' : '#334155' }}>
                    🏠 House Photo
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `PAN Card - ${detailedApp.fullName}`, url: detailedApp.panUrl || '' })} style={{ padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                    📄 PAN Card
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `Aadhaar Card - ${detailedApp.fullName}`, url: detailedApp.aadhaarUrl || '' })} style={{ padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                    🆔 Aadhaar Card
                  </button>
                  {detailedApp.acceptanceScreenshotUrl && (
                    <button onClick={() => setSelectedDoc({ title: `₹1 Acceptance Payment Proof - ${detailedApp.fullName}`, url: detailedApp.acceptanceScreenshotUrl })} style={{ padding: '10px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: 700, color: '#B45309' }}>
                      🧾 ₹1 Proof
                    </button>
                  )}
                  {detailedApp.pendingEmiScreenshotUrl && (
                    <button onClick={() => setSelectedDoc({ title: `EMI Payment Proof - ${detailedApp.fullName}`, url: detailedApp.pendingEmiScreenshotUrl })} style={{ padding: '10px', background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: 700, color: '#1D4ED8' }}>
                      🧾 EMI Proof
                    </button>
                  )}
                </div>
              </div>

              {/* Actions Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div>
                  <b>Current Status:</b> <span style={{ textTransform: 'uppercase', color: '#1E3A8A', fontWeight: 700 }}>{detailedApp.status}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {detailedApp.status === 'under_review' && (
                    <>
                      <button onClick={() => handleApprove(detailedApp.id, detailedApp.fullName, detailedApp, modalRate)} style={{ background: '#16A34A', color: 'white', padding: '8px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>
                        ✓ Approve Offer @ {modalRate}%
                      </button>
                      <button onClick={() => handleReject(detailedApp.id, detailedApp.fullName)} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        ✕ Reject
                      </button>
                    </>
                  )}
                  {detailedApp.status === 'acceptance_submitted' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {detailedApp.acceptanceScreenshotUrl && (
                        <button onClick={() => setSelectedDoc({ title: `₹1 Acceptance Payment Proof - ${detailedApp.fullName}`, url: detailedApp.acceptanceScreenshotUrl })} style={{ background: '#0284C7', color: 'white', padding: '8px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}>
                          📸 View Screenshot Proof ↗
                        </button>
                      )}
                      <button onClick={() => handleApproveAcceptance(detailedApp.id, detailedApp)} style={{ background: '#16A34A', color: 'white', padding: '8px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>
                        ✓ Payment Received (Approve ₹1)
                      </button>
                      <button onClick={() => handleRejectAcceptance(detailedApp.id, detailedApp)} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        ✕ Reject ₹1
                      </button>
                    </div>
                  )}
                  {isAccepted && (
                    <button onClick={() => handleDisburse(detailedApp.id, detailedApp)} style={{ background: '#2563EB', color: 'white', padding: '8px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 6px rgba(37,99,235,0.35)' }}>
                      💳 Disburse ₹{modalCalc.netDisbursal.toLocaleString('en-IN')} to {detailedApp.bankName}
                    </button>
                  )}
                  <button onClick={() => setDetailedApp(null)} style={{ background: '#E2E8F0', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 4: DOCUMENT PREVIEW & DOWNLOAD LIGHTBOX */}
      {/* ========================================================================= */}
      {selectedDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0F172A' }}>{selectedDoc.title}</h3>
              <button onClick={() => setSelectedDoc(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ textAlign: 'center', margin: '16px 0', background: '#F8FAFC', padding: '16px', borderRadius: '8px' }}>
              <img src={selectedDoc.url} alt="Document Preview" style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: '6px', border: '1px solid #e2e8f0', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button onClick={() => downloadFile(selectedDoc.url, 'document.jpg')} style={{ background: '#2563eb', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                Download Original File
              </button>
              <button onClick={() => setSelectedDoc(null)} style={{ background: '#e2e8f0', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#334155' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
