
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
import type { DocumentData } from "firebase/firestore";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "firebase/storage";
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
    isAI: false,
    createdAt: serverTimestamp()
  });
  return gameRef.id;
};

export const createAIGame = async (user: User, profile: any, difficulty: string) => {
  const gameRef = await addDoc(collection(db, "games"), {
    white: {
      uid: user.uid,
      name: profile?.username || user.email?.split('@')[0] || "Pilot",
      rating: profile?.elo || 1200
    },
    black: {
      uid: "titanium-ai",
      name: "TITANIUM CORE",
      rating: difficulty === 'pro' ? 2800 : 1500
    },
    fen: STARTING_FEN,
    turn: "w",
    status: GameStatus.ACTIVE,
    isAI: true,
    difficulty,
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

export const uploadAvatar = async (uid: string, file: File) => {
  const storageRef = ref(storage, `user_avatars/${uid}/profile.jpg`);
  const metadata = { contentType: file.type };
  await uploadBytes(storageRef, file, metadata);
  const downloadURL = await getDownloadURL(storageRef);
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, { avatarUrl: downloadURL, lastProfileUpdate: serverTimestamp() }, { merge: true });
  const currentUser = auth.currentUser;
  if (currentUser) await updateProfile(currentUser, { photoURL: downloadURL });
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
  orderBy,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  signOut as firebaseSignOut
};

export type { User, DocumentData };
