
// Foundation: Initializing Firebase Mothership Core
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
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
  query,
  where,
  limit,
  getDocs
} from "firebase/firestore";
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

export { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  limit,
  getDocs
};
export const firebaseSignOut = signOut;

export { doc, setDoc, getDoc, onSnapshot, serverTimestamp };

export type { User, DocumentData };
