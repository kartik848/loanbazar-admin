import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import type { LoanApplication, ApplicationStatus } from '../types/loan';

const firebaseConfig = {
  apiKey: "AIzaSyCzvSmn2A_kSLrDfA3frRzj2WWwFs7p3VQ",
  appId: "1:536165799568:web:d57bd180486fd4f319ea15",
  messagingSenderId: "536165799568",
  projectId: "loan-bazaar-3a60b",
  authDomain: "loan-bazaar-3a60b.firebaseapp.com",
  storageBucket: "loan-bazaar-3a60b.firebasestorage.app",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const subscribeToApplications = (
  callback: (applications: LoanApplication[]) => void
) => {
  const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const apps = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as LoanApplication[];
    callback(apps);
  }, (error) => {
    console.error("Firestore subscription error: ", error);
  });
};

export const updateApplicationStatus = async (
  id: string, 
  status: ApplicationStatus
) => {
  const ref = doc(db, 'applications', id);
  await updateDoc(ref, { status });
};
