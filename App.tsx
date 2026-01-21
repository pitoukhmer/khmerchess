
import React, { useState, useEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Chess, Move } from 'chess.js';
import ReactMarkdown from 'react-markdown';
import { 
  Trophy, Swords, Zap, Users, BookOpen, Layout, 
  MessageSquare, LogOut, Mail, Lock as LockIcon, Loader2, AlertCircle, ShieldAlert, Plus, UserPlus, Copy, Check, Triangle, RotateCcw
} from 'lucide-react';
import ChessBoard from './components/ChessBoard';
import { getCoachAnalysis } from './services/geminiService';
import { 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  firebaseSignOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  createGame,
  joinGame
} from './services/firebaseService';
import type { User } from './services/firebaseService';
import { UserProfile, GameStatus } from './types';

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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

// Fix: Use the named 'Component' import instead of 'React.Component' to resolve TypeScript property visibility issues.
class ChessErrorBoundary extends Component<ChessErrorBoundaryProps, ChessErrorBoundaryState> {
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
      // Update status to completed on checkmate or draw
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [databaseError, setDatabaseError] = useState<'disabled' | 'permissions' | null>(null);

  const [activeTab, setActiveTab] = useState<'play' | 'puzzles' | 'social' | 'learn' | 'prd'>('play');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [joinIdInput, setJoinIdInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const { gameState, makeMove } = useGame(activeGameId, user?.uid || null);

  const [coachTip, setCoachTip] = useState<string>("Ready for a match? Create a game and invite a friend.");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

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
      } else {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const handleCreateGame = async () => {
    if (!user) return;
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
    if (!user || !joinIdInput.trim()) return;
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

  const handleCopyId = () => {
    if (activeGameId) {
      navigator.clipboard.writeText(activeGameId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCred.user.uid;
        const username = email.split('@')[0];
        await setDoc(doc(db, "users", uid), {
          uid, username, elo: 1200, country: "KH",
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

  const handleLogout = async () => {
    setActiveGameId(null);
    await firebaseSignOut(auth);
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

  if (authLoading) {
    return (
      <div className="h-screen w-full bg-[#0C0C0C] flex flex-col items-center justify-center text-zinc-500">
        <Loader2 className="animate-spin mb-4 text-[#CCFF00]" size={48} />
        <p className="font-heavy tracking-widest text-[10px] uppercase">Booting Anti-Gravity Engine...</p>
      </div>
    );
  }

  if (databaseError) {
    return (
      <div className="h-screen bg-[#0C0C0C] flex items-center justify-center p-6 text-center">
        <div className="max-w-xl border border-red-900/30 rounded-3xl p-10 bg-[#1F1F1F] shadow-2xl">
          <AlertCircle className="mx-auto text-red-500 mb-6" size={64} />
          <h2 className="text-2xl font-heavy mb-4 uppercase tracking-tighter text-red-500">System Lockout</h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10">Check Firestore rules or project status in the Console.</p>
          <a href="https://console.firebase.google.com" target="_blank" className="btn-primary px-8 py-4">Open Console</a>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen bg-[#0C0C0C] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#1F1F1F] border border-zinc-800 rounded-xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#CCFF00]" />
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-16 h-16 bg-[#CCFF00] rounded flex items-center justify-center text-black shadow-xl mb-4">
              <Trophy size={32} />
            </div>
            <h1 className="font-heavy text-3xl text-[#CCFF00] mb-2 tracking-tight uppercase">Khmer Chess</h1>
            <p className="text-zinc-500 text-[10px] font-heavy uppercase tracking-widest">Titanium Grade Platform</p>
          </div>
          <form onSubmit={handleAuthAction} className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200 outline-none focus:border-[#CCFF00]" placeholder="Identity (Email)" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200 outline-none focus:border-[#CCFF00]" placeholder="Cipher (Password)" required />
            <button type="submit" className="w-full btn-primary py-4">Authorize Access</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-zinc-600 text-[10px] font-heavy uppercase tracking-widest hover:text-white transition-colors">{isSignUp ? 'Back to Login' : 'New Identity'}</button>
          {authError && <p className="mt-4 text-center text-red-500 text-xs">{authError}</p>}
        </div>
      </div>
    );
  }

  const isPending = gameState?.status === GameStatus.PENDING;
  const isOpponentReady = gameState?.status === GameStatus.ACTIVE;
  const currentChess = new Chess(gameState?.fen || STARTING_FEN);
  const isGameOver = currentChess.isGameOver();
  const turn = gameState?.turn || 'w';
  const playerColor = gameState?.black?.uid === user?.uid ? 'b' : 'w';
  const isMyTurn = turn === playerColor && isOpponentReady;

  const opponent = gameState?.black?.uid === user.uid ? gameState?.white : gameState?.black;

  // Determine Game Over Result
  let gameOverTitle = "Game Over";
  let winnerText = "Draw";
  if (currentChess.isCheckmate()) {
    gameOverTitle = "Checkmate";
    winnerText = currentChess.turn() === 'w' ? `${gameState?.black?.name} Wins` : `${gameState?.white?.name} Wins`;
  } else if (currentChess.isDraw()) {
    gameOverTitle = "Draw";
    winnerText = "Stalemate / 50-move rule";
  }

  return (
    <div className="flex h-screen bg-[#0C0C0C] text-zinc-100 overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-64 bg-[#1F1F1F] border-r border-zinc-800 flex flex-col items-center md:items-stretch py-8 shrink-0">
        <div className="px-6 mb-10 flex items-center gap-3">
          <Trophy className="text-[#CCFF00]" size={24} />
          <h1 className="hidden md:block font-heavy text-xl tracking-tighter text-[#CCFF00] uppercase">Mothership</h1>
        </div>
        <div className="flex-1 space-y-2 px-3">
          {[{id:'play',icon:<Swords/>},{id:'puzzles',icon:<Zap/>},{id:'social',icon:<Users/>},{id:'learn',icon:<BookOpen/>},{id:'prd',icon:<Layout/>}].map((tab) => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`w-full flex items-center gap-4 px-4 py-3 rounded transition-all ${activeTab === tab.id ? 'bg-[#CCFF00] text-black shadow-neon' : 'text-zinc-500 hover:text-white'}`}
            >
              {React.cloneElement(tab.icon as React.ReactElement, { size: 20, className: activeTab === tab.id ? 'text-black' : '' })}
              <span className="hidden md:block font-heavy uppercase text-[12px] tracking-widest">{tab.id}</span>
            </button>
          ))}
        </div>
        <div className="px-3 py-4 border-t border-zinc-800 mt-auto">
          <button onClick={handleLogout} className="w-full flex items-center gap-4 text-zinc-600 hover:text-red-400 group">
            <LogOut size={22} /><span className="hidden md:block font-heavy uppercase text-[10px] tracking-widest group-hover:text-red-400">Logout</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {activeTab === 'play' && (
          <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 flex flex-col gap-4">
               {/* Opponent Card - Top on Mobile */}
               <div className={`bg-[#1F1F1F] p-4 border-l-4 transition-all duration-300 ${turn === (playerColor === 'w' ? 'b' : 'w') && isOpponentReady ? 'border-[#CCFF00] shadow-neon' : 'border-transparent'}`}>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-zinc-800 border border-zinc-700 rounded-sm flex items-center justify-center text-zinc-500 text-lg font-heavy">
                          {opponent?.name?.[0].toUpperCase() || '?'}
                        </div>
                        <div>
                            <p className="text-[10px] font-heavy uppercase tracking-[0.2em] text-zinc-500">Opponent</p>
                            <h3 className="text-lg font-heavy uppercase tracking-tighter text-white">
                              {opponent?.name || (isPending ? 'Waiting for Link...' : 'Offline')}
                            </h3>
                            <p className="text-[10px] text-zinc-600 font-heavy">RATING: {opponent?.rating || 1200}</p>
                        </div>
                    </div>
                    <div className="text-3xl font-heavy text-zinc-700 tracking-tighter">10:00</div>
                 </div>
               </div>

               {/* Game Board Container - Middle on Mobile */}
               <div className="relative aspect-square w-full max-w-[580px] mx-auto group">
                 {!activeGameId && (
                   <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm m-0 gap-8 p-6 md:p-12 text-center border-2 border-zinc-800">
                     <Triangle className="text-[#CCFF00] mb-2 fill-[#CCFF00] rotate-180" size={48} />
                     <div>
                       <h2 className="text-[#CCFF00] font-heavy uppercase tracking-[0.3em] text-2xl mb-4">New Engagement</h2>
                       <p className="text-zinc-500 text-[10px] uppercase font-heavy max-w-[280px] mx-auto leading-loose tracking-widest">Connect to the Mothership and establish an encrypted handshake with another pilot.</p>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 w-full max-w-sm">
                       <button 
                         onClick={handleCreateGame} 
                         disabled={isProcessing}
                         className="flex flex-col items-center gap-4 p-4 md:p-6 bg-[#1F1F1F] border-2 border-zinc-800 hover:border-[#CCFF00] transition-all group active:scale-95 shadow-lg"
                       >
                         <Plus className="text-[#CCFF00] group-hover:scale-125 transition-transform" size={32} />
                         <span className="text-[10px] font-heavy uppercase tracking-widest">Initialize</span>
                       </button>
                       <div className="flex flex-col gap-3 p-4 md:p-6 bg-[#1F1F1F] border-2 border-zinc-800">
                          <UserPlus className="text-zinc-600 mx-auto" size={24} />
                          <input 
                            type="text" 
                            placeholder="CODE" 
                            value={joinIdInput}
                            onChange={(e) => setJoinIdInput(e.target.value)}
                            className="bg-black border border-zinc-800 py-2 text-[10px] font-heavy uppercase tracking-widest text-center focus:border-[#CCFF00] outline-none text-[#CCFF00]"
                          />
                          <button 
                            onClick={handleJoinGame}
                            disabled={isProcessing || !joinIdInput}
                            className="btn-primary py-2 text-[10px] shadow-neon"
                          >
                            Join
                          </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {isPending && gameState?.white?.uid === user.uid && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-10 text-center border-4 border-[#1F1F1F]">
                        <div className="w-20 h-20 border-4 border-[#CCFF00] border-t-transparent rounded-full animate-spin mb-8 shadow-neon" />
                        <h2 className="text-[#CCFF00] font-heavy uppercase tracking-[0.4em] text-xl mb-6">Synchronizing...</h2>
                        <p className="text-zinc-500 text-[10px] font-heavy uppercase tracking-widest mb-10 max-w-xs">Broadcasting tactical coordinates. Awaiting peer connection.</p>
                        
                        <div className="flex items-center gap-3 bg-[#1F1F1F] border-2 border-zinc-800 p-4 w-full max-w-sm shadow-2xl">
                           <span className="flex-1 font-mono text-[#CCFF00] text-sm font-bold truncate">{activeGameId}</span>
                           <button onClick={handleCopyId} className="p-2 hover:bg-zinc-800 text-zinc-400 transition-colors">
                              {copied ? <Check size={20} className="text-[#CCFF00]" /> : <Copy size={20} />}
                           </button>
                        </div>
                        
                        <button 
                          onClick={() => setActiveGameId(null)} 
                          className="mt-12 text-[10px] uppercase font-heavy tracking-widest text-red-500 hover:text-red-400 transition-colors"
                        >
                          Abort Mission
                        </button>
                    </div>
                 )}

                 {/* Game Over Modal - Enhanced */}
                 {isGameOver && (
                   <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
                      <div className="text-center p-8 md:p-12 border-4 border-[#CCFF00] bg-black shadow-neon-glow m-4 w-full max-w-md">
                         <h2 className="text-[#CCFF00] font-heavy text-4xl md:text-6xl uppercase tracking-tighter mb-4 italic leading-none">{gameOverTitle}</h2>
                         <div className="h-1 w-full bg-[#CCFF00]/20 mb-6" />
                         <p className="text-white text-lg font-heavy uppercase tracking-widest mb-2">{winnerText}</p>
                         <p className="text-zinc-500 text-[10px] font-heavy uppercase tracking-widest mb-10">MOTHERSHIP TRANSMISSION TERMINATED</p>
                         
                         <div className="grid grid-cols-1 gap-4">
                           <button 
                             onClick={() => setActiveGameId(null)}
                             className="btn-primary py-4 flex items-center justify-center gap-3 shadow-neon"
                           >
                             <RotateCcw size={18} />
                             New Engagement
                           </button>
                           <button 
                             onClick={() => setActiveTab('social')}
                             className="text-zinc-500 hover:text-white uppercase text-[10px] font-heavy tracking-[0.2em] transition-colors"
                           >
                             Return to Base
                           </button>
                         </div>
                      </div>
                   </div>
                 )}

                 <ChessErrorBoundary>
                   <ChessBoard 
                     fen={gameState?.fen || STARTING_FEN} 
                     onMove={handleMove} 
                     orientation={playerColor as 'w' | 'b'}
                     activeTurn={isMyTurn}
                   />
                 </ChessErrorBoundary>
               </div>

               {/* Player Card - Bottom on Mobile */}
               <div className={`bg-[#1F1F1F] p-4 border-l-4 transition-all duration-300 ${isMyTurn ? 'border-[#CCFF00] shadow-neon-glow' : 'border-transparent'}`}>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 flex items-center justify-center text-lg font-heavy transition-all ${isMyTurn ? 'bg-[#CCFF00] text-black shadow-neon' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                          {profile?.username?.[0].toUpperCase() || user?.email?.[0].toUpperCase()}
                        </div>
                        <div>
                            <p className="text-[10px] font-heavy uppercase tracking-[0.2em] text-[#CCFF00]">Pilot (You)</p>
                            <h3 className="text-lg font-heavy uppercase tracking-tighter text-white">
                              {profile?.username || user.email?.split('@')[0] || 'Pilot'}
                            </h3>
                            <p className="text-[10px] text-zinc-600 font-heavy">ELO: {profile?.elo || 1200}</p>
                        </div>
                    </div>
                    <div className={`text-3xl font-heavy tracking-tighter transition-colors ${isMyTurn ? 'text-[#CCFF00]' : 'text-zinc-700'}`}>10:00</div>
                 </div>
               </div>
            </div>

            {/* Tactical Sidebar - Bottom of everything on Mobile */}
            <div className="flex flex-col gap-6 h-full mt-4 lg:mt-0">
              <div className="bg-[#1F1F1F] p-6 md:p-8 border border-zinc-800 shadow-2xl relative">
                <div className="absolute top-0 right-0 p-4">
                   <Zap size={16} className="text-[#CCFF00] animate-pulse" />
                </div>
                <h3 className="flex items-center gap-3 text-white font-heavy mb-8 uppercase text-xs tracking-[0.3em]">
                  Tactical Analysis
                </h3>
                <div className="min-h-[160px] text-zinc-400 text-sm leading-relaxed font-medium">
                  {isAnalyzing && (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                      <div className="w-8 h-8 border-2 border-[#CCFF00] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] uppercase tracking-widest font-heavy">Calculating depths...</span>
                    </div>
                  )}
                  {!isAnalyzing && (
                    <div className="relative p-4 border-l-2 border-zinc-700 bg-black/20 overflow-hidden">
                      <ReactMarkdown className="markdown-content">{coachTip}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-[#1F1F1F] p-6 border border-zinc-800 flex flex-col gap-4">
                 <h4 className="text-zinc-500 font-heavy text-[10px] uppercase tracking-widest">Mothership Log</h4>
                 <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 border-b border-zinc-800 pb-2">
                       <span>TRANSMISSION</span>
                       <span>STATUS</span>
                    </div>
                    {/* Log entries */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#CCFF00]">
                       <span>HANDSHAKE_ESTABLISHED</span>
                       <span>OK</span>
                    </div>
                    {isOpponentReady && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#CCFF00]">
                        <span>OPPONENT_ENGAGED</span>
                        <span>LIVE</span>
                      </div>
                    )}
                    {isGameOver && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-red-500">
                        <span>CONNECTION_TERMINATED</span>
                        <span>DONE</span>
                      </div>
                    )}
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
