
import React, { useState, useEffect, useCallback, ErrorInfo, ReactNode, Component, useRef } from 'react';
import { Chess, Move } from 'chess.js';
import ReactMarkdown from 'react-markdown';
import { 
  Trophy, Swords, Zap, Users, BookOpen, Layout, 
  MessageSquare, LogOut, Mail, Lock as LockIcon, Loader2, AlertCircle, ShieldAlert, Plus, UserPlus, Copy, Check, Triangle, RotateCcw,
  ShieldCheck, Send, X, Save, FileText, UserPlus2, Trash2, Camera, ShieldEllipsis, Crown
} from 'lucide-react';
import ChessBoard from './components/ChessBoard';
import LandingPage from './components/LandingPage';
import { getCoachAnalysis } from './services/geminiService';
import { 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  firebaseSignOut, 
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  createGame,
  joinGame,
  signInWithGoogle,
  saveGameToLibrary,
  addFriendToContacts,
  collection,
  query,
  orderBy,
  uploadAvatar
} from './services/firebaseService';
import type { User } from './services/firebaseService';
import { UserProfile, GameStatus, SavedGame, Friend } from './types';

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FREE_PLAN_LIMIT = 5;

// Toggle for Email Verification Shield (Set to true to enable)
const ENABLE_EMAIL_VERIFICATION = false;

// Audio Engine
const playSound = (type: 'move' | 'capture' | 'check' | 'game_end') => {
  const sounds = {
    move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
    capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
    check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
    game_end: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3'
  };
  const audio = new Audio(sounds[type]);
  audio.play().catch(() => {}); // Catch browser policy blocks
};

interface ChessErrorBoundaryProps {
  children?: ReactNode;
}

interface ChessErrorBoundaryState {
  hasError: boolean;
  error: string;
}

// Fix: Explicitly use React.Component to ensure TypeScript correctly resolves the base class's properties like state and props.
class ChessErrorBoundary extends React.Component<ChessErrorBoundaryProps, ChessErrorBoundaryState> {
  constructor(props: ChessErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: ''
    };
  }

  static getDerivedStateFromError(error: Error): ChessErrorBoundaryState {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ChessBoard Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-950/20 border border-red-900/50 rounded-2xl aspect-square">
          <AlertCircle className="text-red-500 mb-4" size={48} />
          <h2 className="text-red-500 font-heavy uppercase text-xs tracking-widest mb-2">Engine Conflict</h2>
          <p className="text-zinc-500 text-[10px] text-center max-w-[200px] font-mono leading-relaxed">
            Board Error: {this.state.error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-900 text-white text-[10px] font-heavy uppercase rounded-lg"
          >
            Reboot Core
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const useGame = (gameId: string | null, userId: string | null) => {
  const [gameState, setGameState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const unsubscribe = onSnapshot(doc(db, "games", gameId), (docSnap) => {
      if (docSnap.exists()) {
        setGameState(docSnap.data());
      }
    }, (err) => {
      console.error("Game Sync Error:", err);
      setError(err.message);
    });

    return () => unsubscribe();
  }, [gameId]);

  const makeMove = async (move: Move, newFen: string) => {
    if (!gameId || !gameState) return;
    
    const isWhite = gameState.white.uid === userId;
    const isBlack = gameState.black?.uid === userId;
    const currentTurn = gameState.turn;

    if ((currentTurn === 'w' && !isWhite) || (currentTurn === 'b' && !isBlack)) {
      return;
    }

    const game = new Chess(gameState.fen);
    const result = game.move(move);
    
    if (result.captured) playSound('capture');
    else playSound('move');
    if (game.isCheck()) playSound('check');
    if (game.isGameOver()) {
      playSound('game_end');
      await updateDoc(doc(db, "games", gameId), {
        status: GameStatus.COMPLETED,
        winner: game.isCheckmate() ? (currentTurn === 'w' ? 'white' : 'black') : 'draw'
      });
    }

    try {
      await updateDoc(doc(db, "games", gameId), {
        fen: newFen,
        turn: currentTurn === 'w' ? 'b' : 'w',
        lastMove: { from: move.from, to: move.to },
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.error("Move Update Failed:", err);
    }
  };

  return { gameState, makeMove, error };
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<'disabled' | 'permissions' | null>(null);

  const [activeTab, setActiveTab] = useState<'play' | 'puzzles' | 'social' | 'learn' | 'prd'>('play');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [joinIdInput, setJoinIdInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [refreshToggle, setRefreshToggle] = useState(0);

  // Dashboards state
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGamePgn, setNewGamePgn] = useState('');
  const [newFriendName, setNewFriendName] = useState('');

  const { gameState, makeMove } = useGame(activeGameId, user?.uid || null);
  const [coachTip, setCoachTip] = useState<string>("Ready for a match? Create a game and invite a friend.");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeLibrary: (() => void) | null = null;
    let unsubscribeFriends: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        unsubscribeProfile = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        }, (error) => {
          if (error.code === 'permission-denied') setDatabaseError('permissions');
        });

        // Sync Library
        const qLibrary = query(collection(db, "users", currentUser.uid, "saved_games"), orderBy("createdAt", "desc"));
        unsubscribeLibrary = onSnapshot(qLibrary, (snap) => {
          setSavedGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedGame)));
        });

        // Sync Friends
        const qFriends = query(collection(db, "users", currentUser.uid, "friends"), orderBy("addedAt", "desc"));
        unsubscribeFriends = onSnapshot(qFriends, (snap) => {
          setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() } as Friend)));
        });

      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        if (unsubscribeLibrary) unsubscribeLibrary();
        if (unsubscribeFriends) unsubscribeFriends();
        setProfile(null);
        setSavedGames([]);
        setFriends([]);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeLibrary) unsubscribeLibrary();
      if (unsubscribeFriends) unsubscribeFriends();
    };
  }, []);

  const handleCreateGame = async () => {
    if (!user || (ENABLE_EMAIL_VERIFICATION && !user.emailVerified)) return;
    setIsProcessing(true);
    try {
      const gid = await createGame(user, profile);
      setActiveGameId(gid);
    } catch (err: any) {
      alert(`Create Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinGame = async () => {
    if (!user || (ENABLE_EMAIL_VERIFICATION && !user.emailVerified) || !joinIdInput.trim()) return;
    setIsProcessing(true);
    try {
      const gid = await joinGame(joinIdInput.trim(), user, profile);
      setActiveGameId(gid);
    } catch (err: any) {
      alert(`Join Failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      console.warn("Handshake Aborted: No file selected or user unauthenticated.");
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    console.log(`Analyzing payload... Size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    
    if (file.size > MAX_SIZE) {
      alert(`Mothership Intercept: Payload too large. Limit is 10MB. Detected: ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    console.log("Starting upload...");
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(user.uid, file);
      console.log("Avatar successfully committed to Mothership.");
    } catch (err: any) {
      console.error("Upload Error Details:", err);
      alert("UPLOAD FAILED: " + (err.message || "Unknown error during transmission."));
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openArchiveModal = () => {
    if (savedGames.length >= FREE_PLAN_LIMIT) {
      setIsUpgradeModalOpen(true);
    } else {
      setIsLibraryModalOpen(true);
    }
  };

  const handleSaveGame = async () => {
    if (!user || !newGameTitle || !newGamePgn) return;
    
    // Safety check: Backend integrity enforcement
    if (savedGames.length >= FREE_PLAN_LIMIT) {
      setIsLibraryModalOpen(false);
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsProcessing(true);
    try {
      await saveGameToLibrary(user.uid, newGameTitle, newGamePgn);
      setIsLibraryModalOpen(false);
      setNewGameTitle('');
      setNewGamePgn('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!user) return;
    if (confirm("Permanently purge this tactical file from the dossiers?")) {
      await deleteDoc(doc(db, "users", user.uid, "saved_games", gameId));
    }
  };

  const handleAddFriend = async () => {
    if (!user || !newFriendName) return;
    setIsProcessing(true);
    try {
      await addFriendToContacts(user.uid, newFriendName);
      setIsFriendModalOpen(false);
      setNewFriendName('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        if (ENABLE_EMAIL_VERIFICATION) {
          await sendEmailVerification(userCred.user);
        }
        const username = email.split('@')[0];
        await setDoc(doc(db, "users", userCred.user.uid), {
          uid: userCred.user.uid, username, elo: 1200, country: "KH",
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
          joinDate: new Date().toISOString(),
          isOnline: true, createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message || "Auth Error");
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      const result = await signInWithGoogle();
      const user = result.user;
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        const username = user.displayName || user.email?.split('@')[0] || "Pilot";
        await setDoc(docRef, {
          uid: user.uid, username, elo: 1200, country: "KH",
          avatarUrl: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          joinDate: new Date().toISOString(),
          isOnline: true, createdAt: serverTimestamp()
        });
      }
    } catch (error: any) {
      setAuthError(error.message || "Google Authentication Failed");
    }
  };

  const handleLogout = async () => {
    setActiveGameId(null);
    await firebaseSignOut(auth);
  };

  const handleReloadUser = async () => {
    if (user) {
      try {
        await reload(user);
        setRefreshToggle(prev => prev + 1);
      } catch (err: any) {
        alert("Reload failed: " + err.message);
      }
    }
  };

  const handleMove = async (move: Move) => {
    if (!activeGameId || !gameState) return;
    const currentFen = (!gameState.fen || gameState.fen === 'start') ? STARTING_FEN : gameState.fen;
    const gameLogic = new Chess(currentFen);
    try {
      const result = gameLogic.move(move);
      if (result) {
        await makeMove(result, gameLogic.fen());
        setIsAnalyzing(true);
        const tip = await getCoachAnalysis(gameLogic.fen(), result.san);
        setCoachTip(tip);
        setIsAnalyzing(false);
      }
    } catch (e) {
      console.warn("Invalid move");
    }
  };

  if (authLoading) return (
    <div className="h-screen w-full bg-[#0C0C0C] flex flex-col items-center justify-center text-zinc-500">
      <Loader2 className="animate-spin mb-4 text-[#CCFF00]" size={48} />
      <p className="font-heavy tracking-widest text-[10px] uppercase">Booting Anti-Gravity Engine...</p>
    </div>
  );

  // Phase 6: Traffic Cop Logic
  if (!user) {
    if (showAuthForm) {
      return (
        <div className="h-screen bg-[#0C0C0C] flex items-center justify-center p-6 relative">
          <button 
            onClick={() => setShowAuthForm(false)}
            className="absolute top-8 left-8 text-zinc-500 hover:text-white flex items-center gap-2 font-heavy uppercase text-[10px] tracking-widest transition-all"
          >
            <RotateCcw size={16} /> Return to Landing
          </button>
          <div className="max-w-md w-full bg-[#1F1F1F] border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#CCFF00]" />
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="w-16 h-16 bg-[#CCFF00] rounded flex items-center justify-center text-black shadow-xl mb-4"><Trophy size={32} /></div>
              <h1 className="font-heavy text-3xl text-[#CCFF00] mb-2 tracking-tight uppercase">Identity Auth</h1>
              <p className="text-zinc-500 text-[10px] font-heavy uppercase tracking-widest">Enter the Ledger</p>
            </div>
            <form onSubmit={handleAuthAction} className="space-y-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200 outline-none focus:border-[#CCFF00]" placeholder="Identity (Email)" required />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200 outline-none focus:border-[#CCFF00]" placeholder="Cipher (Password)" required />
              <button type="submit" className="w-full btn-primary py-4">Authorize Access</button>
            </form>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-800"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase font-heavy tracking-widest"><span className="bg-[#1F1F1F] px-4 text-zinc-600">Secondary Handshake</span></div>
            </div>
            <button onClick={handleGoogleSignIn} className="w-full bg-transparent border border-[#CCFF00]/30 hover:border-[#CCFF00] text-white py-4 flex items-center justify-center gap-3 transition-all rounded-lg text-[12px] font-heavy uppercase tracking-widest">
              <Mail size={18} className="text-[#CCFF00]" /> Google Sync
            </button>
            <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-zinc-600 text-[10px] font-heavy uppercase tracking-widest hover:text-white transition-colors">{isSignUp ? 'Back to Login' : 'New Identity'}</button>
            {authError && <p className="mt-4 text-center text-red-500 text-xs font-mono">{authError}</p>}
          </div>
        </div>
      );
    }
    
    return (
      <LandingPage 
        onGoogleLogin={handleGoogleSignIn} 
        onShowEmailAuth={() => setShowAuthForm(true)} 
      />
    );
  }

  if (ENABLE_EMAIL_VERIFICATION && user && !user.emailVerified) return (
    <div key={refreshToggle} className="h-screen bg-[#0C0C0C] flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#1F1F1F] p-10 rounded-xl border border-[#CCFF00]/20 shadow-2xl">
        <ShieldAlert className="text-[#CCFF00] mx-auto mb-6" size={64} />
        <h2 className="text-[#CCFF00] font-heavy text-2xl mb-4">VERIFICATION REQ</h2>
        <p className="text-zinc-400 text-sm mb-8">Establish credentials via link sent to {user.email}.</p>
        <button onClick={handleReloadUser} className="btn-primary w-full py-4 mb-4">I've Verified</button>
        <button onClick={handleLogout} className="text-zinc-600 uppercase text-[10px] font-heavy tracking-widest">Logout</button>
      </div>
    </div>
  );

  const playerColor = gameState?.black?.uid === user?.uid ? 'b' : 'w';
  const isMyTurn = (gameState?.turn || 'w') === playerColor && gameState?.status === GameStatus.ACTIVE;

  return (
    <div className="flex h-screen bg-[#0C0C0C] text-zinc-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-64 bg-[#1F1F1F] border-r border-zinc-800 flex flex-col items-center md:items-stretch py-8 shrink-0">
        <div className="px-6 mb-10 flex items-center gap-3"><Trophy className="text-[#CCFF00]" size={24} /><h1 className="hidden md:block font-heavy text-xl text-[#CCFF00] uppercase">Mothership</h1></div>
        <div className="flex-1 space-y-2 px-3">
          {[
            {id:'play',icon:<Swords/>,label:'Play'},
            {id:'puzzles',icon:<Zap/>,label:'Puzzles'},
            {id:'social',icon:<Users/>,label:'Social'},
            {id:'learn',icon:<BookOpen/>,label:'Library'},
            {id:'prd',icon:<Layout/>,label:'Interface'}
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-4 px-4 py-3 rounded transition-all ${activeTab === tab.id ? 'bg-[#CCFF00] text-black shadow-neon' : 'text-zinc-500 hover:text-white'}`}>
              {React.cloneElement(tab.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 20, className: activeTab === tab.id ? 'text-black' : '' })}
              <span className="hidden md:block font-heavy uppercase text-[12px] tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto px-4 py-6 border-t border-zinc-800/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 flex items-center justify-center">
                {isUploadingAvatar ? (
                  <Loader2 className="animate-spin text-[#CCFF00]" size={16} />
                ) : (
                  <img src={profile?.avatarUrl} className="w-full h-full object-cover" />
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
              >
                <Camera size={14} className="text-[#CCFF00]" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="hidden md:block">
              <p className="text-white text-[11px] font-heavy uppercase truncate max-w-[120px]">{profile?.username}</p>
              <p className="text-[#CCFF00] text-[9px] font-heavy tracking-widest">{profile?.elo} ELO</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-4 text-zinc-600 hover:text-red-400 group"><LogOut size={22} /><span className="hidden md:block font-heavy uppercase text-[10px] group-hover:text-red-400">Logout</span></button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        
        {/* PLAY TAB */}
        {activeTab === 'play' && (
          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 flex flex-col gap-4">
               <div className="relative aspect-square w-full max-w-[580px] mx-auto group">
                 {!activeGameId && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm border-2 border-zinc-800 gap-8">
                       <Triangle className="text-[#CCFF00] rotate-180" size={48} />
                       <h2 className="text-[#CCFF00] font-heavy uppercase tracking-[0.3em] text-2xl">Engagement</h2>
                       <div className="grid grid-cols-2 gap-6 w-full max-w-sm px-4">
                          <button onClick={handleCreateGame} className="flex flex-col items-center gap-4 p-6 bg-[#1F1F1F] border-2 border-zinc-800 hover:border-[#CCFF00] transition-all"><Plus size={32} className="text-[#CCFF00]"/><span className="text-[10px] font-heavy uppercase tracking-widest">Init</span></button>
                          <div className="flex flex-col gap-3 p-6 bg-[#1F1F1F] border-2 border-zinc-800"><UserPlus size={24} className="text-zinc-600 mx-auto"/><input type="text" placeholder="CODE" value={joinIdInput} onChange={(e) => setJoinIdInput(e.target.value)} className="bg-black border border-zinc-800 py-2 text-[10px] font-heavy uppercase text-center focus:border-[#CCFF00] outline-none text-[#CCFF00]"/><button onClick={handleJoinGame} className="btn-primary py-2 text-[10px]">Join</button></div>
                       </div>
                    </div>
                 )}
                 <ChessErrorBoundary>
                   <ChessBoard fen={gameState?.fen || STARTING_FEN} onMove={handleMove} orientation={playerColor as 'w' | 'b'} activeTurn={isMyTurn} />
                 </ChessErrorBoundary>
               </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="bg-[#1F1F1F] p-8 border border-zinc-800 relative">
                <Zap size={16} className="absolute top-4 right-4 text-[#CCFF00] animate-pulse" />
                <h3 className="text-white font-heavy mb-8 uppercase text-xs tracking-[0.3em]">Tactical Analysis</h3>
                <div className="min-h-[160px] text-zinc-400 text-sm leading-relaxed markdown-content">
                  <ReactMarkdown>{coachTip}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === 'social' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-heavy text-white uppercase tracking-tighter italic">Peer Handshake</h2>
                <p className="text-[10px] text-zinc-500 font-heavy uppercase tracking-widest">Active Pilot Contacts</p>
              </div>
              <button onClick={() => setIsFriendModalOpen(true)} className="btn-primary px-6 py-3 flex items-center gap-2 text-[10px] shadow-neon">
                <UserPlus2 size={16} /> Add Contact
              </button>
            </div>
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-zinc-800 text-center rounded-2xl">
                   <Users className="mx-auto text-zinc-700 mb-4" size={48} />
                   <p className="text-zinc-500 font-heavy uppercase text-[10px] tracking-widest">Isolated Signal. No peers connected.</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <div key={friend.id} className="bg-[#1F1F1F] p-4 flex items-center justify-between border border-zinc-800 hover:border-[#CCFF00]/50 transition-colors group">
                    <div className="flex items-center gap-4">
                       <div className="relative">
                         <div className="w-12 h-12 bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 font-heavy border border-zinc-800 overflow-hidden">
                           {friend.avatarUrl ? <img src={friend.avatarUrl} className="w-full h-full object-cover" /> : friend.username[0].toUpperCase()}
                         </div>
                         <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#1F1F1F] ${friend.status === 'online' ? 'bg-[#CCFF00]' : 'bg-zinc-600'}`} />
                       </div>
                       <div>
                         <h4 className="text-white font-heavy uppercase tracking-tighter">{friend.username}</h4>
                         <p className="text-[9px] text-zinc-600 font-heavy uppercase tracking-widest">Last Sync: Established</p>
                       </div>
                    </div>
                    <button className="p-3 text-zinc-700 hover:text-[#CCFF00] transition-colors"><MessageSquare size={18} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'learn' && (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-heavy text-white uppercase tracking-tighter italic">Tactical Dossiers</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-zinc-500 font-heavy uppercase tracking-widest shrink-0">Secure PGN Storage</p>
                  <div className="h-[1px] w-8 bg-zinc-800" />
                  <p className={`text-[10px] font-heavy uppercase tracking-widest ${savedGames.length >= FREE_PLAN_LIMIT ? 'text-orange-500' : 'text-[#CCFF00]'}`}>
                    Storage Used: {savedGames.length} / {FREE_PLAN_LIMIT} Games
                  </p>
                </div>
              </div>
              <button onClick={openArchiveModal} className="btn-primary px-6 py-3 flex items-center gap-2 text-[10px] shadow-neon">
                <Save size={16} /> Archive Game
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedGames.length === 0 ? (
                 <div className="col-span-full p-20 border-2 border-dashed border-zinc-800 text-center rounded-2xl">
                    <FileText className="mx-auto text-zinc-700 mb-4" size={64} />
                    <p className="text-zinc-500 font-heavy uppercase text-[10px] tracking-widest">No tactical archives found. Secure your wins.</p>
                 </div>
              ) : (
                savedGames.map((game) => (
                  <div key={game.id} className="bg-[#1F1F1F] p-6 border border-zinc-800 flex flex-col gap-6 group hover:border-[#CCFF00] transition-all relative overflow-hidden">
                    <div className="flex items-start justify-between">
                       <h4 className="text-white font-heavy uppercase tracking-tight text-lg leading-tight flex-1 pr-4">{game.title}</h4>
                       <button onClick={() => handleDeleteGame(game.id)} className="text-zinc-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                    </div>
                    <div className="bg-black/40 p-3 rounded font-mono text-[9px] text-[#CCFF00] overflow-hidden whitespace-nowrap overflow-ellipsis">
                       {game.pgn}
                    </div>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-zinc-800">
                       <span className="text-[9px] text-zinc-600 font-heavy uppercase">{new Date(game.createdAt?.toDate()).toLocaleDateString()}</span>
                       <button className="text-[10px] font-heavy uppercase text-[#CCFF00] flex items-center gap-1 group-hover:translate-x-1 transition-transform">Analyze Dossier <Swords size={12}/></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* NEW RECORD MODAL */}
        {isLibraryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1F1F1F] border-2 border-zinc-800 p-8 w-full max-w-md relative shadow-neon-glow">
               <button onClick={() => setIsLibraryModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
               <h3 className="text-[#CCFF00] font-heavy uppercase mb-6 tracking-widest">New Tactical Record</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-heavy text-zinc-500 uppercase tracking-widest">Archive Title</label>
                    <input type="text" value={newGameTitle} onChange={(e) => setNewGameTitle(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm outline-none focus:border-[#CCFF00]" placeholder="Win vs Pitou 2024"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-heavy text-zinc-500 uppercase tracking-widest">PGN Data</label>
                    <textarea value={newGamePgn} onChange={(e) => setNewGamePgn(e.target.value)} rows={6} className="w-full bg-black border border-zinc-800 p-3 text-white text-xs outline-none focus:border-[#CCFF00] font-mono" placeholder="1. e4 e5 2. Nf3..."/>
                  </div>
                  <button onClick={handleSaveGame} disabled={isProcessing} className="w-full btn-primary py-4 text-sm flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 className="animate-spin" /> : <><Save size={18}/> Commit to Library</>}
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* UPGRADE MODAL */}
        {isUpgradeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="bg-[#1F1F1F] border-2 border-orange-500/50 p-10 w-full max-w-md relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <ShieldEllipsis size={120} className="text-orange-500" />
               </div>
               <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10"><X size={20}/></button>
               
               <div className="relative z-10">
                 <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 border border-orange-500/30">
                   <Crown size={32} className="text-orange-500" />
                 </div>
                 
                 <h3 className="text-orange-500 font-heavy uppercase mb-2 tracking-widest text-xl italic">Library Limit Reached</h3>
                 <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                   You have reached the limit of <span className="text-white font-heavy">{FREE_PLAN_LIMIT} saved games</span> on the Free Plan. Upgrade to the Titanium Tier for unlimited tactical archives and high-performance analysis.
                 </p>
                 
                 <div className="space-y-3">
                    <button 
                      onClick={() => alert("Mothership Update: Payment Gateway Integration Coming Soon!")} 
                      className="w-full bg-orange-500 hover:bg-orange-600 text-black font-heavy uppercase py-4 rounded-lg tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20"
                    >
                      Upgrade to Pro (Unlimited)
                    </button>
                    <button onClick={() => setIsUpgradeModalOpen(false)} className="w-full text-zinc-600 uppercase font-heavy text-[10px] tracking-[0.2em] py-2 hover:text-zinc-400 transition-colors">
                      Return to Command
                    </button>
                 </div>
               </div>
            </div>
          </div>
        )}

        {isFriendModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1F1F1F] border-2 border-zinc-800 p-8 w-full max-w-md relative">
               <button onClick={() => setIsFriendModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
               <h3 className="text-[#CCFF00] font-heavy uppercase mb-6 tracking-widest">Signal Handshake</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-heavy text-zinc-500 uppercase tracking-widest">Pilot Identity (Username or Email)</label>
                    <input type="text" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm outline-none focus:border-[#CCFF00]" placeholder="CaptainVandeth"/>
                  </div>
                  <button onClick={handleAddFriend} disabled={isProcessing} className="w-full btn-primary py-4 text-sm">Initialize Contact</button>
               </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;
