
export enum GameStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED'
}

export enum PieceColor {
  WHITE = 'w',
  BLACK = 'b'
}

export interface UserProfile {
  uid: string;
  username: string;
  elo: number;
  avatarUrl: string;
  country: string;
  joinDate: string;
  isOnline: boolean;
}

export interface Move {
  from: string;
  to: string;
  promotion?: string;
  timestamp: number;
}

export interface GameSession {
  gameId: string;
  white: string; // uid
  black: string; // uid
  moves: Move[];
  status: GameStatus;
  fen: string;
  startTime: number;
  lastMoveTime: number;
  winner?: string; // uid or 'draw'
  timeControl: number; // in seconds
}

export interface SavedGame {
  id: string;
  title: string;
  pgn: string;
  createdAt: any;
}

export interface Friend {
  id: string;
  username: string;
  status: 'online' | 'offline';
  avatarUrl?: string;
  addedAt: any;
}

export interface Puzzle {
  id: string;
  fen: string;
  solution: string[];
  rating: number;
  title: string;
}

export interface AnalysisNode {
  score: number;
  bestMove: string;
  explanation: string;
}
