
import React, { useState, useEffect, useCallback, ErrorInfo, ReactNode, Component, useRef } from 'react';
import { Chess, Move } from 'chess.js';
import ReactMarkdown from 'react-markdown';
import { 
  Trophy, Swords, Zap, Users, BookOpen, Layout, 
  MessageSquare, LogOut, Mail, Loader2, AlertCircle, Plus, UserPlus, Triangle, RotateCcw,
  ShieldCheck, X, Save, FileText, UserPlus2, Trash2, Camera, ShieldEllipsis, Crown, Radio, Target, Cpu, User as UserIcon
} from 'lucide-react';
import ChessBoard from './components/ChessBoard';
import LandingPage from './components/LandingPage';
import InstallPrompt from './components/InstallPrompt';
import { getCoachAnalysis, getBotMove } from './services/geminiService';
import { 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  firebaseSignOut, 
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  createGame,
  createAIGame,
  joinGame,
  signInWithGoogle,
  saveGameToLibrary,
  addFriendToContacts,
  collection,
  query,
  where,
  orderBy,
  limit,
  uploadAvatar
} from './services/firebaseService';
import type { User } from './services/firebaseService';
import { UserProfile, GameStatus, SavedGame, Friend } from './types';

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const FREE_PLAN_LIMIT = 5;

const playSound = (type: 'move' | 'capture' | 'check' | 'game_end') => {
  const sounds = {
    move: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3',
    capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3',
    check: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-check.mp3',
    game_end: 'https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/game-end.mp3'
  };
  const audio = new Audio(sounds[type]);
  audio.play().catch(() => {});
};

interface ChessErrorBoundaryProps { children?: ReactNode; }
interface ChessErrorBoundaryState { hasError: boolean; error: string; }

// Fix: Use explicitly imported Component and define state property to resolve type inference issues where 'state' and 'props' were reported as missing.
class ChessErrorBoundary extends Component<ChessErrorBoundaryProps, ChessErrorBoundaryState> {
  state: ChessErrorBoundaryState = { hasError: false, error: '' };

  constructor(props: ChessErrorBoundaryProps) {
    super(props);
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
          <p className="text-zinc-500 text-[10px] text-center max-w-[200px] font-mono leading-relaxed">Board Error: {this.state.error}</p>
          <button onClick={() => window.location.reload()} className="mt-6 px-4 py-2 bg-red-900 text-white text-[10px] font-heavy uppercase rounded-lg">Reboot Core</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const useGame = (gameId: string | null, userId: string | null) => {
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    if (!gameId) return;
    const unsubscribe = onSnapshot(doc(db, "games", gameId), (docSnap) => {
      if (docSnap.exists()) setGameState(docSnap.data());
    });
    return () => unsubscribe();
  }, [gameId]);

  const makeMove = async (move: Move, newFen: string) => {
    if (!gameId || !gameState) return;
    const isWhite = gameState.white.uid === userId;
    const isBlack = gameState.black?.uid === userId;
    const currentTurn = gameState.turn;

    if ((currentTurn === 'w' && !isWhite) || (currentTurn === 'b' && !isBlack)) return;

    const game = new Chess(gameState.fen);
    game.move(move);
    
    if (game.isGameOver()) {
      playSound('game_end');
      await updateDoc(doc(db, "games", gameId), {
        status: GameStatus.COMPLETED,
        winner: game.isCheckmate() ? (currentTurn === 'w' ? 'white' : 'black') : 'draw'
      });
    }

    await updateDoc(doc(db, "games", gameId), {
      fen: newFen,
      turn: currentTurn === 'w' ? 'b' : 'w',
      lastMove: { from: move.from, to: move.to },
      lastUpdated: serverTimestamp()
    });
  };

  return { gameState, makeMove };
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

  const [activeTab, setActiveTab] = useState<'play' | 'puzzles' | 'social' | 'learn' | 'prd'>('play');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [openGames, setOpenGames] = useState<any[]>([]);
  const [joinIdInput, setJoinIdInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [coachTip, setCoachTip] = useState<string>("Ready for a match? Challenge the AI or join a lobby.");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Global Syncs
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) setProfile(docSnap.data() as UserProfile);
        });

        // Sync Lobby
        const qLobby = query(collection(db, "games"), where("status", "==", GameStatus.PENDING), orderBy("createdAt", "desc"), limit(10));
        onSnapshot(qLobby, (snap) => setOpenGames(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        // Sync Library & Friends
        const qLib = query(collection(db, "users", currentUser.uid, "saved_games"), orderBy("createdAt", "desc"));
        onSnapshot(qLib, (snap) => setSavedGames(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedGame))));
        const qFr = query(collection(db, "users", currentUser.uid, "friends"), orderBy("addedAt", "desc"));
        onSnapshot(qFr, (snap) => setFriends(snap.docs.map(d => ({ id: d.id, ...d.data() } as Friend))));
      }
      setAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // AI Move Handler
  useEffect(() => {
    const triggerAIMove = async () => {
      if (gameState?.status === GameStatus.ACTIVE && gameState?.isAI && gameState.turn === 'b' && !isAnalyzing) {
        setIsAnalyzing(true);
        const botMoveStr = await getBotMove(gameState.fen, gameState.difficulty);
        if (botMoveStr) {
          const gameLogic = new Chess(gameState.fen);
          try {
            const move = gameLogic.move(botMoveStr);
            if (move) {
              await makeMove(move, gameLogic.fen());
              const tip = await getCoachAnalysis(gameLogic.fen(), move.san);
              setCoachTip(tip);
            }
          } catch (e) { console.warn("AI returned invalid move:", botMoveStr); }
        }
        setIsAnalyzing(false);
      }
    };
    triggerAIMove();
  }, [gameState?.fen, gameState?.turn, gameState?.isAI]);

  // Fix: Added handleLogout to clear session state and trigger Firebase signout
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      setActiveGameId(null);
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const handleCreateGame = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const gid = await createGame(user, profile);
      setActiveGameId(gid);
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  const handleCreateAIBattle = async (diff: 'easy' | 'pro') => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const gid = await createAIGame(user, profile, diff);
      setActiveGameId(gid);
      setCoachTip("AI Battle Initialized. Good luck, pilot.");
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  const handleJoinGame = async (gid: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await joinGame(gid, user, profile);
      setActiveGameId(gid);
    } catch (err: any) { alert(err.message); }
    finally { setIsProcessing(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingAvatar(true);
    try { await uploadAvatar(user.uid, file); }
    catch (err: any) { alert(err.message); }
    finally { setIsUploadingAvatar(false); }
  };

  const handleMove = async (move: Move) => {
    if (!activeGameId || !gameState) return;
    const gameLogic = new Chess(gameState.fen || STARTING_FEN);
    try {
      const result = gameLogic.move(move);
      if (result) {
        await makeMove(result, gameLogic.fen());
        playSound(result.captured ? 'capture' : 'move');
        if (gameLogic.isCheck()) playSound('check');
        setIsAnalyzing(true);
        const tip = await getCoachAnalysis(gameLogic.fen(), result.san);
        setCoachTip(tip);
        setIsAnalyzing(false);
      }
    } catch (e) { console.warn("Invalid move"); }
  };

  if (authLoading) return (
    <div className="h-screen w-full bg-[#0C0C0C] flex flex-col items-center justify-center text-zinc-500">
      <Loader2 className="animate-spin mb-4 text-[#CCFF00]" size={48} />
      <p className="font-heavy tracking-widest text-[10px] uppercase">Booting Titanium Core...</p>
    </div>
  );

  if (!user) {
    if (showAuthForm) return (
      <div className="h-screen bg-[#0C0C0C] flex items-center justify-center p-6 relative">
        <button onClick={() => setShowAuthForm(false)} className="absolute top-8 left-8 text-zinc-500 hover:text-white flex items-center gap-2 font-heavy uppercase text-[10px] tracking-widest transition-all">
          <RotateCcw size={16} /> Return to Landing
        </button>
        <div className="max-w-md w-full bg-[#1F1F1F] border border-zinc-800 rounded-xl p-8 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#CCFF00]" />
          <div className="flex flex-col items-center mb-10 text-center">
            <Trophy size={48} className="text-[#CCFF00] mb-4" />
            <h1 className="font-heavy text-3xl uppercase tracking-tight italic">Identity Auth</h1>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            setAuthError(null);
            (isSignUp ? createUserWithEmailAndPassword(auth, email, password) : signInWithEmailAndPassword(auth, email, password))
              .catch(err => setAuthError(err.message));
          }} className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200" placeholder="Email" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 px-4 text-sm text-zinc-200" placeholder="Password" required />
            <button type="submit" className="w-full btn-primary py-4">Authorize</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="w-full mt-6 text-zinc-600 text-[10px] font-heavy uppercase tracking-widest hover:text-white">{isSignUp ? 'Back to Login' : 'New Identity'}</button>
          {authError && <p className="mt-4 text-center text-red-500 text-xs font-mono">{authError}</p>}
        </div>
      </div>
    );
    return <LandingPage onGoogleLogin={signInWithGoogle} onShowEmailAuth={() => setShowAuthForm(true)} />;
  }

  const playerColor = gameState?.black?.uid === user?.uid ? 'b' : 'w';
  const isMyTurn = (gameState?.turn || 'w') === playerColor && gameState?.status === GameStatus.ACTIVE;

  return (
    <div className="flex h-screen bg-[#0C0C0C] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-64 bg-[#1F1F1F] border-r border-zinc-800 flex flex-col items-center md:items-stretch py-8 shrink-0">
        <div className="px-6 mb-10 flex items-center gap-3"><Trophy className="text-[#CCFF00]" size={24} /><h1 className="hidden md:block font-heavy text-xl text-[#CCFF00] uppercase italic">Mothership</h1></div>
        <div className="flex-1 space-y-2 px-3">
          {[
            {id:'play',icon:<Swords/>,label:'Lobby'},
            {id:'puzzles',icon:<Target/>,label:'Missions'},
            {id:'social',icon:<Users/>,label:'Peers'},
            {id:'learn',icon:<BookOpen/>,label:'Library'}
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`w-full flex items-center gap-4 px-4 py-3 rounded transition-all ${activeTab === tab.id ? 'bg-[#CCFF00] text-black shadow-neon' : 'text-zinc-500 hover:text-white'}`}>
              {React.cloneElement(tab.icon as React.ReactElement<{ size?: number; className?: string }>, { size: 20, className: activeTab === tab.id ? 'text-black' : '' })}
              <span className="hidden md:block font-heavy uppercase text-[11px] tracking-widest">{tab.label}</span>
            </button>
          ))}
          
          <div className="pt-8 px-3">
            <InstallPrompt />
          </div>
        </div>
        <div className="mt-auto px-4 py-6 border-t border-zinc-800/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative group cursor-pointer w-10 h-10 rounded bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center">
              {isUploadingAvatar ? <Loader2 className="animate-spin text-[#CCFF00]" size={16} /> : <img src={profile?.avatarUrl} className="w-full h-full object-cover" />}
              <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Camera size={14} className="text-[#CCFF00]" /></button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>
            <div className="hidden md:block">
              <p className="text-white text-[11px] font-heavy uppercase truncate max-w-[120px]">{profile?.username}</p>
              <p className="text-[#CCFF00] text-[9px] font-heavy tracking-widest">{profile?.elo} ELO</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-4 text-zinc-600 hover:text-red-400 group transition-colors"><LogOut size={20} /><span className="hidden md:block font-heavy uppercase text-[10px]">Eject</span></button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        
        {/* PLAY TAB - LOBBY REFACTORED */}
        {activeTab === 'play' && (
          <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-10 items-start">
            
            {/* Board Signal */}
            <div className="lg:col-span-8 flex flex-col gap-6">
               <div className="relative aspect-square w-full max-w-[620px] mx-auto group">
                 {!activeGameId ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0C0C0C]/95 border-2 border-zinc-800 gap-10 p-10">
                       <Radio className="text-[#CCFF00] animate-pulse" size={64} />
                       <div className="text-center">
                         <h2 className="text-[#CCFF00] font-heavy uppercase tracking-[0.4em] text-3xl mb-2">Signal Radar</h2>
                         <p className="text-zinc-600 font-heavy text-[10px] uppercase tracking-widest">Scanning for active pilots...</p>
                       </div>
                       
                       <div className="w-full max-lg grid md:grid-cols-2 gap-6">
                          <button onClick={handleCreateGame} className="flex flex-col items-center gap-4 p-8 bg-[#1F1F1F] border-2 border-zinc-800 hover:border-[#CCFF00] transition-all group">
                             <Plus size={32} className="text-[#CCFF00] group-hover:scale-125 transition-transform"/>
                             <span className="text-[11px] font-heavy uppercase tracking-widest">Host Match</span>
                          </button>
                          <div className="flex flex-col gap-4 p-8 bg-[#1F1F1F] border-2 border-zinc-800">
                             <Cpu size={32} className="text-zinc-700 mx-auto"/>
                             <div className="flex gap-2">
                               <button onClick={() => handleCreateAIBattle('easy')} className="flex-1 text-[9px] font-heavy bg-zinc-900 border border-zinc-800 py-3 uppercase tracking-widest hover:border-[#CCFF00]">Easy AI</button>
                               <button onClick={() => handleCreateAIBattle('pro')} className="flex-1 text-[9px] font-heavy bg-zinc-900 border border-zinc-800 py-3 uppercase tracking-widest hover:border-orange-500 text-orange-500">Titanium</button>
                             </div>
                          </div>
                       </div>

                       {/* Open Signals List */}
                       <div className="w-full space-y-3 mt-4 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
                         {openGames.length === 0 ? (
                            <div className="p-10 border border-zinc-900 bg-zinc-900/20 text-center rounded">
                              <Loader2 className="animate-spin mx-auto mb-4 text-zinc-800" size={20} />
                              <p className="text-zinc-700 font-heavy text-[10px] uppercase">Awaiting incoming signals...</p>
                            </div>
                         ) : (
                           openGames.map((g) => (
                             <div key={g.id} className="bg-[#1F1F1F] p-4 flex items-center justify-between border border-zinc-800 hover:border-[#CCFF00]/40 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className="w-8 h-8 rounded-full bg-zinc-900 border border-[#CCFF00]/20 flex items-center justify-center text-[#CCFF00] font-heavy text-xs italic">
                                    {g.white.name[0]}
                                  </div>
                                  <div>
                                    <h4 className="text-white text-[11px] font-heavy uppercase italic">{g.white.name}</h4>
                                    <p className="text-zinc-600 text-[9px] font-heavy uppercase tracking-widest">{g.white.rating} ELO</p>
                                  </div>
                               </div>
                               <button onClick={() => handleJoinGame(g.id)} className="btn-primary px-6 py-2 text-[9px]">Engage</button>
                             </div>
                           ))
                         )}
                       </div>
                    </div>
                 ) : (
                   <div className="space-y-4">
                      <div className="flex items-center justify-between bg-[#1F1F1F] px-6 py-3 border border-zinc-800">
                        <div className="flex items-center gap-3">
                           <div className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-[#CCFF00] animate-ping' : 'bg-zinc-800'}`} />
                           <span className="text-[10px] font-heavy uppercase tracking-widest text-zinc-400">Battle Channel Active</span>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-[9px] text-zinc-600 font-heavy uppercase">Opponent</p>
                              <p className="text-white text-[11px] font-heavy uppercase italic">{gameState?.black?.name || "Awaiting Signal..."}</p>
                           </div>
                           <button onClick={() => setActiveGameId(null)} className="p-2 hover:bg-zinc-800 text-zinc-600 hover:text-white transition-colors"><X size={16}/></button>
                        </div>
                      </div>
                      <ChessErrorBoundary>
                        <ChessBoard fen={gameState?.fen || STARTING_FEN} onMove={handleMove} orientation={playerColor as 'w' | 'b'} activeTurn={isMyTurn} />
                      </ChessErrorBoundary>
                   </div>
                 )}
               </div>
            </div>

            {/* Analysis & Tactical Feed */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="bg-[#1F1F1F] p-8 border border-zinc-800 relative min-h-[300px] flex flex-col shadow-2xl">
                <div className="flex items-center gap-3 mb-10 border-b border-zinc-800 pb-4">
                  <Zap size={16} className="text-[#CCFF00] animate-pulse" />
                  <h3 className="text-white font-heavy uppercase text-[11px] tracking-[0.3em]">Titanium Feedback</h3>
                </div>
                <div className="flex-1 text-zinc-400 text-sm leading-relaxed markdown-content italic">
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-700">
                       <Loader2 className="animate-spin" size={24} />
                       <span className="text-[9px] font-heavy uppercase tracking-[0.5em]">Crunching Tactics...</span>
                    </div>
                  ) : (
                    <ReactMarkdown>{coachTip}</ReactMarkdown>
                  )}
                </div>
                <div className="mt-8 pt-6 border-t border-zinc-800 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] shadow-neon" />
                     <span className="text-[8px] text-zinc-600 font-heavy uppercase tracking-widest">AI Core Synced</span>
                   </div>
                   <button onClick={() => setCoachTip("Recalibrating tactical model...")} className="text-zinc-700 hover:text-white transition-colors"><RotateCcw size={12}/></button>
                </div>
              </div>

              {/* Player Dossier Snippet */}
              <div className="bg-[#1F1F1F] p-6 border border-zinc-800 border-l-4 border-l-[#CCFF00]/40">
                <div className="flex items-center gap-3 mb-4">
                  <UserIcon size={14} className="text-[#CCFF00]" />
                  <h4 className="text-white font-heavy uppercase text-[10px] tracking-widest italic">Pilot Performance</h4>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-3 rounded">
                    <p className="text-zinc-600 text-[8px] font-heavy uppercase mb-1">Current ELO</p>
                    <p className="text-[#CCFF00] text-lg font-heavy italic tracking-tighter">{profile?.elo}</p>
                  </div>
                  <div className="bg-black/40 p-3 rounded">
                    <p className="text-zinc-600 text-[8px] font-heavy uppercase mb-1">Rank</p>
                    <p className="text-white text-lg font-heavy italic tracking-tighter">ELITE</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MISSIONS TAB (Puzzles Placeholder) */}
        {activeTab === 'puzzles' && (
          <div className="max-w-5xl mx-auto py-20 text-center">
             <Target className="mx-auto text-[#CCFF00] mb-8 animate-bounce" size={64} />
             <h2 className="text-4xl font-heavy text-white uppercase italic tracking-tighter mb-4">The Crucible</h2>
             <p className="text-zinc-500 max-w-lg mx-auto mb-12">Solve high-stakes chess missions designed by the Titanium AI. Earn ELO and prestige for every tactical execution.</p>
             <div className="grid md:grid-cols-2 gap-8 text-left">
                <div className="bg-[#1F1F1F] p-10 border border-zinc-800 opacity-50 cursor-not-allowed">
                   <h3 className="text-[#CCFF00] font-heavy uppercase text-xl italic mb-4">Mission 01: Siege</h3>
                   <p className="text-sm text-zinc-600 mb-6">Breach the fortified kingside in 4 moves. Rewards: +20 Prestige.</p>
                   <div className="bg-zinc-900 h-1 rounded overflow-hidden"><div className="bg-zinc-800 w-full h-full" /></div>
                </div>
                <div className="bg-[#1F1F1F] p-10 border border-zinc-800 group relative cursor-pointer hover:border-[#CCFF00] transition-all">
                   <div className="absolute top-4 right-4 text-[#CCFF00] text-[10px] font-heavy uppercase tracking-widest">Active</div>
                   <h3 className="text-white font-heavy uppercase text-xl italic mb-4">Tutorial: The Open</h3>
                   <p className="text-sm text-zinc-500 mb-6">Master the fundamental openings of the Khmer ledger. Rewards: Badge.</p>
                   <button className="btn-primary px-8 py-3 text-[10px]">Deploy Now</button>
                </div>
             </div>
          </div>
        )}

        {/* SOCIAL TAB */}
        {activeTab === 'social' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-heavy text-white uppercase tracking-tighter italic">Peer Contacts</h2>
                <p className="text-[10px] text-zinc-500 font-heavy uppercase tracking-widest">Mothership Network</p>
              </div>
              <button onClick={() => setIsFriendModalOpen(true)} className="btn-primary px-6 py-3 flex items-center gap-2 text-[10px] shadow-neon">
                <UserPlus2 size={16} /> Add Pilot
              </button>
            </div>
            <div className="space-y-3">
              {friends.length === 0 ? (
                <div className="p-20 border-2 border-dashed border-zinc-800 text-center rounded-2xl">
                   <Users className="mx-auto text-zinc-700 mb-4" size={48} />
                   <p className="text-zinc-500 font-heavy uppercase text-[10px] tracking-widest">No signals detected. Invite a peer.</p>
                </div>
              ) : (
                friends.map((friend) => (
                  <div key={friend.id} className="bg-[#1F1F1F] p-4 flex items-center justify-between border border-zinc-800 hover:border-[#CCFF00]/50 transition-colors group">
                    <div className="flex items-center gap-4">
                       <div className="relative w-12 h-12 bg-zinc-900 rounded border border-zinc-800 overflow-hidden flex items-center justify-center">
                         {friend.avatarUrl ? <img src={friend.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="text-zinc-700"/>}
                         <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1F1F1F] ${friend.status === 'online' ? 'bg-[#CCFF00]' : 'bg-zinc-800'}`} />
                       </div>
                       <div>
                         <h4 className="text-white font-heavy uppercase tracking-tighter">{friend.username}</h4>
                         <p className="text-[9px] text-zinc-600 font-heavy uppercase tracking-widest">Ready for combat</p>
                       </div>
                    </div>
                    <button className="p-3 text-zinc-800 hover:text-[#CCFF00] transition-colors"><MessageSquare size={18} /></button>
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
                <h2 className="text-2xl font-heavy text-white uppercase tracking-tighter italic">Tactical Archives</h2>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-zinc-500 font-heavy uppercase tracking-widest">PGN Vault</p>
                  <div className="h-[1px] w-8 bg-zinc-800" />
                  <p className={`text-[10px] font-heavy uppercase tracking-widest ${savedGames.length >= FREE_PLAN_LIMIT ? 'text-orange-500' : 'text-[#CCFF00]'}`}>
                    {savedGames.length} / {FREE_PLAN_LIMIT} Saved Files
                  </p>
                </div>
              </div>
              <button onClick={() => savedGames.length >= FREE_PLAN_LIMIT ? setIsUpgradeModalOpen(true) : setIsLibraryModalOpen(true)} className="btn-primary px-6 py-3 flex items-center gap-2 text-[10px] shadow-neon">
                <Save size={16} /> Secure Dossier
              </button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedGames.length === 0 ? (
                 <div className="col-span-full p-20 border-2 border-dashed border-zinc-800 text-center rounded-2xl">
                    <FileText className="mx-auto text-zinc-700 mb-4" size={64} />
                    <p className="text-zinc-500 font-heavy uppercase text-[10px] tracking-widest">Archive empty. Start recording victories.</p>
                 </div>
              ) : (
                savedGames.map((game) => (
                  <div key={game.id} className="bg-[#1F1F1F] p-6 border border-zinc-800 flex flex-col gap-6 group hover:border-[#CCFF00] transition-all relative">
                    <div className="flex items-start justify-between">
                       <h4 className="text-white font-heavy uppercase tracking-tight text-lg leading-tight flex-1">{game.title}</h4>
                       <button onClick={() => deleteDoc(doc(db, "users", user.uid, "saved_games", game.id))} className="text-zinc-800 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                    </div>
                    <div className="bg-black/40 p-3 rounded font-mono text-[9px] text-[#CCFF00] overflow-hidden whitespace-nowrap overflow-ellipsis">{game.pgn}</div>
                    <button onClick={() => { setActiveTab('play'); setCoachTip(`Analyzing archived dossier: ${game.title}. Re-running tactical simulations...`); }} className="text-[10px] font-heavy uppercase text-[#CCFF00] flex items-center gap-1 group-hover:translate-x-1 transition-transform mt-auto">Re-Play Dossier <Swords size={12}/></button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Modals Shared Layer */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1F1F1F] border-2 border-zinc-800 p-8 w-full max-w-md relative shadow-neon-glow">
             <button onClick={() => setIsLibraryModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
             <h3 className="text-[#CCFF00] font-heavy uppercase mb-6 tracking-widest">Record Mission</h3>
             <div className="space-y-4">
                <input type="text" value={newGameTitle} onChange={(e) => setNewGameTitle(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm outline-none focus:border-[#CCFF00]" placeholder="Mission Title"/>
                <textarea value={newGamePgn} onChange={(e) => setNewGamePgn(e.target.value)} rows={6} className="w-full bg-black border border-zinc-800 p-3 text-white text-xs outline-none focus:border-[#CCFF00] font-mono" placeholder="PGN Data..."/>
                <button onClick={async () => {
                  setIsProcessing(true);
                  await saveGameToLibrary(user.uid, newGameTitle, newGamePgn);
                  setIsLibraryModalOpen(false);
                  setIsProcessing(false);
                }} className="w-full btn-primary py-4 text-[11px]">Commit to Vault</button>
             </div>
          </div>
        </div>
      )}

      {isFriendModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1F1F1F] border-2 border-zinc-800 p-8 w-full max-w-md relative">
             <button onClick={() => setIsFriendModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
             <h3 className="text-[#CCFF00] font-heavy uppercase mb-6 tracking-widest italic">Pilot Handshake</h3>
             <input type="text" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} className="w-full bg-black border border-zinc-800 p-3 text-white text-sm outline-none focus:border-[#CCFF00] mb-4" placeholder="Pilot Signal (Username)"/>
             <button onClick={async () => {
                await addFriendToContacts(user.uid, newFriendName);
                setIsFriendModalOpen(false);
             }} className="w-full btn-primary py-4">Initialize Signal</button>
          </div>
        </div>
      )}

      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-[#1F1F1F] border-2 border-orange-500/30 p-10 w-full max-w-md relative overflow-hidden shadow-2xl">
             <button onClick={() => setIsUpgradeModalOpen(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
             <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mb-6 border border-orange-500/20 mx-auto">
               <Crown size={32} className="text-orange-500" />
             </div>
             <h3 className="text-orange-500 font-heavy uppercase mb-2 tracking-widest text-xl text-center italic">Vault Limit Reached</h3>
             <p className="text-zinc-500 text-sm leading-relaxed mb-10 text-center">Free pilots are limited to <span className="text-white">5 tactical archives</span>. Upgrade to Titanium for unlimited dossier storage and Pro AI analysis.</p>
             <button onClick={() => alert("Payment Gateway Integration Pending...")} className="w-full bg-[#CCFF00] text-black font-heavy uppercase py-4 rounded shadow-neon mb-2">Upgrade to Titanium</button>
             <button onClick={() => setIsUpgradeModalOpen(false)} className="w-full text-zinc-700 font-heavy uppercase text-[9px] tracking-widest py-2">Continue as Apprentice</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
