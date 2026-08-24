import React, { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, getDocs, query, where, writeBatch, setDoc } from 'firebase/firestore';

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

// Initial sample data in case Firestore is connecting or empty
const initialSampleApps = [
  {
    id: 'demo-app-1',
    fullName: 'Rahul Sharma',
    userPhone: '9876543210',
    userEmail: 'rahul.sharma@gmail.com',
    aadhaarNumber: '234567891234',
    panNumber: 'ABCPS1234K',
    employmentType: 'salaried',
    monthlyIncome: 45000,
    bankName: 'HDFC Bank',
    accountNumber: '50100234567890',
    ifscCode: 'HDFC0001234',
    accountHolderName: 'Rahul Sharma',
    amount: 50000,
    monthlyEmi: 4490.50,
    interestRate: 14.0,
    tenureMonths: 12,
    totalRepayment: 53886.00,
    rbiConsentAccepted: true,
    autoPayConsentAccepted: true,
    razorpayPaymentId: 'pay_Nz82Kx9281aL',
    panUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    aadhaarUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    incomeProofUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    bankStatementUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    status: 'autopay_done',
    isBlocked: false,
    createdAt: '2026-08-20',
  },
  {
    id: 'demo-app-2',
    fullName: 'Pooja Verma',
    userPhone: '9123456780',
    userEmail: 'pooja.verma@outlook.com',
    aadhaarNumber: '876543219876',
    panNumber: 'BKRPA9876M',
    employmentType: 'business',
    monthlyIncome: 65000,
    bankName: 'State Bank of India',
    accountNumber: '304928192834',
    ifscCode: 'SBIN0004567',
    accountHolderName: 'Pooja Verma',
    amount: 30000,
    monthlyEmi: 5200.00,
    interestRate: 16.0,
    tenureMonths: 6,
    totalRepayment: 31200.00,
    rbiConsentAccepted: true,
    autoPayConsentAccepted: false,
    razorpayPaymentId: '',
    panUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    aadhaarUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    incomeProofUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    bankStatementUrl: 'https://i.ibb.co/vzZ8q6K/sample-pan.jpg',
    status: 'under_review',
    isBlocked: false,
    createdAt: '2026-08-22',
  },
  {
    id: 'demo-app-3',
    fullName: 'Amit Kumar',
    userPhone: '9988776655',
    userEmail: 'amit.k@yahoo.com',
    aadhaarNumber: '567890123456',
    panNumber: 'DFGPK3456L',
    employmentType: 'salaried',
    monthlyIncome: 55000,
    bankName: 'ICICI Bank',
    accountNumber: '001205001234',
    ifscCode: 'ICIC0000012',
    accountHolderName: 'Amit Kumar',
    amount: 75000,
    monthlyEmi: 6720.00,
    interestRate: 13.5,
    tenureMonths: 12,
    totalRepayment: 80640.00,
    rbiConsentAccepted: true,
    autoPayConsentAccepted: true,
    razorpayPaymentId: 'pay_Pq71Kz1928bM',
    createdAt: '2026-08-24',
  }
];

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
    // Flat % interest for short-term bullet loans (e.g. 10% on ₹1,000 = ₹100 interest => ₹1,100 repayment)
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
      // Annualized percentage across months: Total Interest = P * (r/100) * (months / 12)
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

export default function App() {
  // Authentication State (Always show Login Screen on fresh session)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Navigation View State ('applications' | 'users')
  const [activeView, setActiveView] = useState<'applications' | 'users'>('applications');

  // Dashboard & Applications State
  const [applications, setApplications] = useState<any[]>(initialSampleApps);
  const [adminRates, setAdminRates] = useState<Record<string, number>>({});
  const [selectedDoc, setSelectedDoc] = useState<{ title: string; url: string } | null>(null);
  const [detailedApp, setDetailedApp] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Users Directory Search State
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'blocked'>('all');

  // Firestore Realtime Listener
  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const unsub = onSnapshot(collection(db, 'applications'), (snapshot) => {
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

      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        if (!snapshot.empty) {
          const liveUsers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          setRegisteredUsers(liveUsers);
        }
      }, (error) => {
        console.warn("Firestore users listener fallback: ", error.message);
      });

      return () => {
        unsub();
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

  // 1. Admin Approve Loan with Specific Custom Percentage
  const handleApprove = async (id: string, name: string, appItem: any, specificRate?: number) => {
    const chosenRate = specificRate !== undefined ? specificRate : (adminRates[id] !== undefined ? adminRates[id] : (Number(appItem.interestRate) || 14.0));
    const calc = calculateAdminLoan(appItem.amount, chosenRate, appItem.tenureMonths, appItem.tenureDays);
    
    const confirmMsg = `CONFIRM APPROVAL:\n\nApplicant: ${name}\nSanctioned Amount: ₹${Number(appItem.amount).toLocaleString('en-IN')}\nApproved Rate: ${chosenRate}% p.a.\nTenure: ${calc.tenureDisplay}\n${calc.isDays ? 'Bullet Due' : 'Monthly EMI'}: ₹${calc.emi.toLocaleString('en-IN')}\nTotal Repay: ₹${calc.totalRepayment.toLocaleString('en-IN')}\nNet Disbursal: ₹${calc.netDisbursal.toLocaleString('en-IN')}\n\nApprove this customized loan offer for user acceptance?`;
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

  // 3. Admin Disburse Funds
  const handleDisburse = async (id: string, appItem: any) => {
    const bank = appItem.bankName || 'Bank';
    const acc = appItem.accountNumber || '';
    const ifsc = appItem.ifscCode || '';
    const amount = appItem.amount || 0;

    const confirmMsg = `CONFIRM DISBURSAL:\n\nTransfer ₹${amount.toLocaleString('en-IN')} to:\nAccount Holder: ${appItem.accountHolderName || appItem.fullName}\nBank: ${bank}\nAccount No: ${acc}\nIFSC: ${ifsc}\n\nMark this loan as Disbursed?`;
    if (!window.confirm(confirmMsg)) return;

    const updateData = {
      status: 'disbursed',
      disbursedBy: 'admin@gmail.com',
      disbursedAt: new Date().toISOString(),
    };
    try {
      await updateDoc(doc(db, 'applications', id), updateData);
    } catch {
      // Local fallback
    }
    setApplications(prev => prev.map(a => a.id === id ? { ...a, ...updateData } : a));
    if (detailedApp?.id === id) setDetailedApp((prev: any) => ({ ...prev, ...updateData }));
  };

  // Global User Block/Unblock across all applications & registered user document
  const toggleBlockUser = async (phone: string, currentStatus: boolean) => {
    const action = currentStatus ? "Unblock" : "Block";
    if (!window.confirm(`Are you sure you want to ${action} user with phone ${phone}?`)) return;

    try {
      // 1. Update user doc in 'users' collection
      await setDoc(doc(db, 'users', phone), { isBlocked: !currentStatus }, { merge: true });

      // 2. Update all applications matching userPhone
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

  // 1. Add all registered users from Firestore 'users' collection
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
      rbiConsentAccepted: false,
      panUrl: null,
      aadhaarUrl: null,
      incomeProofUrl: null,
      selfieUrl: u.photoUrl || null,
      housePhotoUrl: null,
      appsList: []
    });
  });

  // 2. Overlay / Merge application data
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
        rbiConsentAccepted: app.rbiConsentAccepted || false,
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

  // Filtered Users
  const filteredUsers = usersList.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.phone.includes(userSearchQuery) ||
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.pan.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      user.aadhaar.includes(userSearchQuery) ||
      user.employmentType.toLowerCase().includes(userSearchQuery.toLowerCase());
    
    if (userFilter === 'active') return matchesSearch && !user.isBlocked;
    if (userFilter === 'blocked') return matchesSearch && user.isBlocked;
    return matchesSearch;
  });

  // If not authenticated, render Login Screen
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          padding: '40px',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <img
              src="/logo.svg"
              alt="Loan Bazar Logo"
              style={{ width: '80px', height: '80px', borderRadius: '18px', marginBottom: '14px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}
            />
            <h2 style={{ margin: 0, color: '#0F172A', fontSize: '22px', fontWeight: 700 }}>Loan Bazar Admin</h2>
            <p style={{ margin: '6px 0 0 0', color: '#64748B', fontSize: '13px' }}>Sign in to manage credit underwriting & disbursals</p>
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

  // Filter applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.userPhone || '').includes(searchQuery) ||
      (app.userEmail || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.panNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.aadhaarNumber || '').includes(searchQuery) ||
      (app.bankName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.accountNumber || '').includes(searchQuery) ||
      (app.razorpayPaymentId || '').includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Underwriting, KYC Documents, Disbursals & AutoPay Governance</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

      {/* Primary Navigation View Switcher */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '2px solid #E2E8F0', paddingBottom: '12px' }}>
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
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Total Received</div>
              <div style={{ color: '#0F172A', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>{applications.length}</div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>Under Review (Pending)</div>
              <div style={{ color: '#F59E0B', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {applications.filter(a => a.status === 'under_review').length}
              </div>
            </div>
            <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>AutoPay Registered (Ready)</div>
              <div style={{ color: '#3B82F6', fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
                {applications.filter(a => a.status === 'autopay_done').length}
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
                { id: 'approved', label: 'Approved (Waiting AutoPay)' },
                { id: 'autopay_done', label: 'AutoPay Ready (Disburse)' },
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
                    backgroundColor: statusFilter === tab.id ? '#1E3A8A' : '#FFFFFF',
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
                  <th>All Documents (View/Download)</th>
                  <th>Status & AutoPay</th>
                  <th>Admin Action (Strict Workflow)</th>
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

                    return (
                      <tr key={app.id} style={{ borderBottom: '1px solid #f1f5f9', background: app.isBlocked ? '#fef2f2' : 'transparent' }}>
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', minWidth: '180px' }}>
                            <button
                              onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${app.fullName}`, url: app.selfieUrl || 'https://via.placeholder.com/600x400?text=Live+Selfie' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: app.selfieUrl ? '#eff6ff' : '#F1F5F9', border: '1px solid ' + (app.selfieUrl ? '#93c5fd' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: app.selfieUrl ? '#1d4ed8' : '#334155' }}>
                              📸 Selfie
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `House / Residence Photo - ${app.fullName}`, url: app.housePhotoUrl || app.homePhotoUrl || 'https://via.placeholder.com/600x400?text=House+Photo' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: (app.housePhotoUrl || app.homePhotoUrl) ? '#f0fdf4' : '#F1F5F9', border: '1px solid ' + ((app.housePhotoUrl || app.homePhotoUrl) ? '#86efac' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: (app.housePhotoUrl || app.homePhotoUrl) ? '#15803d' : '#334155' }}>
                              🏠 House
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `PAN Card - ${app.fullName}`, url: app.panUrl || 'https://via.placeholder.com/600x400?text=PAN+Card' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                              📄 PAN Card
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `Aadhaar Card - ${app.fullName}`, url: app.aadhaarUrl || app.panUrl || 'https://via.placeholder.com/600x400?text=Aadhaar+Card' })}
                              style={{ padding: '4px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                              🆔 Aadhaar
                            </button>
                            <button
                              onClick={() => setSelectedDoc({ title: `Income / Salary Proof - ${app.fullName}`, url: app.incomeProofUrl || app.proofUrl || 'https://via.placeholder.com/600x400?text=Income+Proof' })}
                              style={{ gridColumn: 'span 2', padding: '4px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                              💼 Salary Slip / Income
                            </button>
                          </div>
                        </td>

                        {/* Status & AutoPay */}
                        <td>
                          <span style={{ 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            display: 'inline-block',
                            marginBottom: '4px',
                            background: app.status === 'disbursed' ? '#dcfce7' : app.status === 'autopay_done' ? '#e0f2fe' : app.status === 'approved' ? '#fef9c3' : app.status === 'rejected' ? '#fee2e2' : '#fffbeb',
                            color: app.status === 'disbursed' ? '#15803d' : app.status === 'autopay_done' ? '#0369a1' : app.status === 'approved' ? '#a16207' : app.status === 'rejected' ? '#b91c1c' : '#b45309'
                          }}>
                            {app.status === 'under_review' && '⏳ Under Review'}
                            {app.status === 'approved' && '✓ Approved (Waiting AutoPay)'}
                            {app.status === 'autopay_done' && '⚡ AutoPay Registered'}
                            {app.status === 'disbursed' && '💰 Disbursed'}
                            {app.status === 'rejected' && '✕ Rejected'}
                          </span>
                          {app.razorpayPaymentId && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Mandate: <code>{app.razorpayPaymentId}</code>
                            </div>
                          )}
                        </td>

                        {/* Admin Strict Action */}
                        <td style={{ minWidth: '190px' }}>
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
                                  {[5, 10, 15, 20].map((r) => (
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
                                <div style={{ fontSize: '10px', color: '#0369A1', lineHeight: '1.3' }}>
                                  Interest: <b>+₹{calc.totalInterest.toLocaleString('en-IN')}</b><br />
                                  {calc.isDays ? 'Bullet Due' : 'Monthly EMI'}: <b style={{ color: '#15803D' }}>₹{calc.emi.toLocaleString('en-IN')}</b>
                                </div>
                              </div>
                              <button
                                onClick={() => handleApprove(app.id, app.fullName, app, appRate)}
                                style={{ background: '#16a34a', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, fontSize: '12px', boxShadow: '0 2px 4px rgba(22,163,74,0.2)' }}>
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
                              <div style={{ fontSize: '11px', color: '#0284C7' }}>Waiting for user to accept offer & setup AutoPay in App</div>
                            </div>
                          )}

                          {app.status === 'autopay_done' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '11px', color: '#047857', background: '#ECFDF5', padding: '4px 6px', borderRadius: '4px', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                                ⚡ AutoPay Mandate Active
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
                                💳 Disburse ₹{(Number(app.netDisbursalAmount) || (Number(app.amount) - (Number(app.processingFee) || 200))).toLocaleString('en-IN')} to {app.bankName || 'Bank'}
                              </button>
                            </div>
                          )}

                          {app.status === 'disbursed' && (
                            <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>✓</span> Amount Transferred to Bank
                            </div>
                          )}

                          {app.status === 'rejected' && (
                            <div style={{ color: '#dc2626', fontSize: '12px' }}>
                              Reason: {app.rejectionReason || 'Declined'}
                            </div>
                          )}
                        </td>

                        {/* More Options / Governance */}
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
                              {app.isBlocked ? 'Unblock' : 'Block User'}
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
      {/* TAB 2: ALL USERS DIRECTORY & MANAGEMENT */}
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

            {/* Dedicated User Search Bar */}
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
                  <th>All Documents</th>
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
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', minWidth: '170px' }}>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'Live Selfie - ' + user.name, url: user.photoUrl || user.selfieUrl || 'https://via.placeholder.com/600x400?text=Live+Selfie' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: (user.photoUrl || user.selfieUrl) ? '#eff6ff' : '#F1F5F9', border: '1px solid ' + ((user.photoUrl || user.selfieUrl) ? '#93c5fd' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: (user.photoUrl || user.selfieUrl) ? 600 : 400, color: (user.photoUrl || user.selfieUrl) ? '#1d4ed8' : '#334155' }}>
                            📸 Selfie
                          </button>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'House Photo - ' + user.name, url: user.housePhotoUrl || 'https://via.placeholder.com/600x400?text=House+Photo' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: user.housePhotoUrl ? '#f0fdf4' : '#F1F5F9', border: '1px solid ' + (user.housePhotoUrl ? '#86efac' : '#CBD5E1'), borderRadius: '4px', fontSize: '11px', fontWeight: user.housePhotoUrl ? 600 : 400, color: user.housePhotoUrl ? '#15803d' : '#334155' }}>
                            🏠 House
                          </button>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'PAN - ' + user.name, url: user.panUrl || 'https://via.placeholder.com/600x400?text=PAN+Card' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px' }}>
                            📄 PAN
                          </button>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'Aadhaar - ' + user.name, url: user.aadhaarUrl || 'https://via.placeholder.com/600x400?text=Aadhaar+Card' })}
                            style={{ padding: '3px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px' }}>
                            🆔 Aadhaar
                          </button>
                          <button 
                            onClick={() => setSelectedDoc({ title: 'Salary / Income Proof - ' + user.name, url: user.incomeProofUrl || 'https://via.placeholder.com/600x400?text=Income+Proof' })}
                            style={{ gridColumn: 'span 2', padding: '3px 6px', cursor: 'pointer', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', fontSize: '11px' }}>
                            💼 Salary Slip
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
      {/* DOSSIER MODAL: COMPLETE APPLICATION DETAILS */}
      {/* ========================================================================= */}
      {detailedApp && (() => {
        const modalRate = adminRates[detailedApp.id] !== undefined ? adminRates[detailedApp.id] : (Number(detailedApp.interestRate) || 14.0);
        const modalCalc = calculateAdminLoan(detailedApp.amount, modalRate, detailedApp.tenureMonths, detailedApp.tenureDays);

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

              {/* Admin Interest Rate Setter & Live Calculation Box (when under_review or approved) */}
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

              {/* Extra Repayment Summary */}
              <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div><b>Interest Rate:</b> {modalRate}% p.a.</div>
                <div><b>Tenure:</b> {modalCalc.tenureDisplay}</div>
                <div><b>Repayment Schedule:</b> <b style={{ color: '#0F172A' }}>{modalCalc.frequencyText}</b></div>
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
                  {detailedApp.razorpayPaymentId && (
                    <div style={{ marginTop: '6px', color: '#15803D' }}><b>AutoPay Mandate ID:</b> <code>{detailedApp.razorpayPaymentId}</code></div>
                  )}
                </div>
              </div>

              {/* Documents Section */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#0F172A' }}>Uploaded KYC & Verification Documents</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  <button onClick={() => setSelectedDoc({ title: `Live Face Selfie - ${detailedApp.fullName}`, url: detailedApp.selfieUrl || '' })} style={{ padding: '10px', background: detailedApp.selfieUrl ? '#EFF6FF' : '#F1F5F9', border: '1px solid ' + (detailedApp.selfieUrl ? '#93C5FD' : '#CBD5E1'), borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: detailedApp.selfieUrl ? 600 : 400, color: detailedApp.selfieUrl ? '#1E3A8A' : '#334155' }}>
                    📸 Live Selfie
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `House / Residence Photo - ${detailedApp.fullName}`, url: detailedApp.housePhotoUrl || detailedApp.homePhotoUrl || '' })} style={{ padding: '10px', background: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#F0FDF4' : '#F1F5F9', border: '1px solid ' + ((detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#86EFAC' : '#CBD5E1'), borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontWeight: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? 600 : 400, color: (detailedApp.housePhotoUrl || detailedApp.homePhotoUrl) ? '#15803D' : '#334155' }}>
                    🏠 House Photo
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `PAN Card - ${detailedApp.fullName}`, url: detailedApp.panUrl || '' })} style={{ padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                    📄 PAN Card
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `Aadhaar Card - ${detailedApp.fullName}`, url: detailedApp.aadhaarUrl || detailedApp.panUrl || '' })} style={{ padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                    🆔 Aadhaar Card
                  </button>
                  <button onClick={() => setSelectedDoc({ title: `Salary Slip - ${detailedApp.fullName}`, url: detailedApp.incomeProofUrl || detailedApp.proofUrl || '' })} style={{ padding: '10px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}>
                    💼 Salary Slip
                  </button>
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
                      <button onClick={() => handleApprove(detailedApp.id, detailedApp.fullName, detailedApp, modalRate)} style={{ background: '#16A34A', color: 'white', padding: '8px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700, boxShadow: '0 2px 4px rgba(22,163,74,0.3)' }}>
                        ✓ Approve Offer @ {modalRate}%
                      </button>
                      <button onClick={() => handleReject(detailedApp.id, detailedApp.fullName)} style={{ background: '#DC2626', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                        ✕ Reject Application
                      </button>
                    </>
                  )}
                  {detailedApp.status === 'autopay_done' && (
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
      {/* DOCUMENT PREVIEW & DOWNLOAD LIGHTBOX MODAL */}
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
