
// Foundation: Initializing Firebase Mothership Core
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  reload,
  updateProfile
} from "firebase/auth";
import type { User } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  getDocs,
  orderBy
} from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
import type { DocumentData } from "firebase/firestore";
import { GameStatus } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyDLWAHs0k-41LapkQ2iU7ouFHdIogFu6PY",
  authDomain: "khmerchess-e576c.firebaseapp.com",
  projectId: "khmerchess-e576c",
  storageBucket: "khmerchess-e576c.firebasestorage.app",
  messagingSenderId: "929838009729",
  appId: "1:929838009729:web:c549166746a5a68b3dec80",
  measurementId: "G-KQGNXHG2RC"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const createGame = async (user: User, profile: any) => {
  const gameRef = await addDoc(collection(db, "games"), {
    white: {
      uid: user.uid,
      name: profile?.username || user.email?.split('@')[0] || "Pilot",
      rating: profile?.elo || 1200
    },
    black: null,
    fen: STARTING_FEN,
    turn: "w",
    status: GameStatus.PENDING,
    createdAt: serverTimestamp()
  });
  return gameRef.id;
};

export const joinGame = async (gameId: string, user: User, profile: any) => {
  const gameRef = doc(db, "games", gameId);
  const snap = await getDoc(gameRef);
  if (!snap.exists()) throw new Error("Mothership Error: Game link not found.");
  
  const data = snap.data();
  if (data.status !== GameStatus.PENDING) throw new Error("Lockout: Game is already full or closed.");
  if (data.white.uid === user.uid) throw new Error("Recursive Error: You are already White.");

  await updateDoc(gameRef, {
    black: {
      uid: user.uid,
      name: profile?.username || user.email?.split('@')[0] || "Pilot",
      rating: profile?.elo || 1200
    },
    status: GameStatus.ACTIVE,
    startTime: serverTimestamp()
  });
  return gameId;
};

// Phase 3: Dashboard Services
export const saveGameToLibrary = async (uid: string, title: string, pgn: string) => {
  return await addDoc(collection(db, "users", uid, "saved_games"), {
    title,
    pgn,
    createdAt: serverTimestamp()
  });
};

export const addFriendToContacts = async (uid: string, usernameOrEmail: string) => {
  return await addDoc(collection(db, "users", uid, "friends"), {
    username: usernameOrEmail,
    status: 'offline',
    addedAt: serverTimestamp()
  });
};

// Phase 4: Storage Services - Enhanced with Upsert Logic
export const uploadAvatar = async (uid: string, file: File) => {
  console.log("Mothership Communication: Preparing payload for upload...");
  
  // Validate file size (10MB threshold)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error(`Mothership Limit: Image must be under 10MB (Detected: ${(file.size / (1024 * 1024)).toFixed(2)}MB).`);
  }

  const storageRef = ref(storage, `user_avatars/${uid}/profile.jpg`);
  
  // Crucial: Set content type to avoid CORS/MIME issues
  const metadata = {
    contentType: file.type,
  };

  console.log(`Starting binary transfer to user_avatars/${uid}/profile.jpg...`);
  
  await uploadBytes(storageRef, file, metadata);
  
  console.log("Transfer successful. Fetching downlink...");
  const downloadURL = await getDownloadURL(storageRef);
  
  console.log("Downlink established:", downloadURL);

  // Update Firestore Source of Truth
  // FIX: Using setDoc with { merge: true } instead of updateDoc to handle missing documents
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { 
    avatarUrl: downloadURL,
    lastProfileUpdate: serverTimestamp() 
  }, { merge: true });
  
  // Sync Firebase Auth Profile for fallback
  const currentUser = auth.currentUser;
  if (currentUser) {
    await updateProfile(currentUser, { photoURL: downloadURL });
  }

  console.log("Profile synchronization with Firestore complete.");
  return downloadURL;
};

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  getDocs,
  orderBy
};
export const firebaseSignOut = signOut;

export { doc, setDoc, getDoc, onSnapshot, serverTimestamp };

export type { User, DocumentData };
