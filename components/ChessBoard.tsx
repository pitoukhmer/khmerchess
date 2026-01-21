
import React, { useState, useEffect } from 'react';
import { Chess, Move } from 'chess.js';

interface ChessBoardProps {
  fen?: string;
  onMove?: (move: Move) => void;
  orientation?: 'w' | 'b';
  activeTurn?: boolean;
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const ChessBoard: React.FC<ChessBoardProps> = ({ 
  fen = STARTING_FEN, 
  onMove, 
  orientation = 'w',
  activeTurn = false
}) => {
  const getValidFen = (f?: string) => {
    if (!f || f === 'start') return STARTING_FEN;
    return f;
  };

  const [game, setGame] = useState(new Chess(getValidFen(fen)));
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  useEffect(() => {
    const validFen = getValidFen(fen);
    if (validFen !== game.fen()) {
      try {
        setGame(new Chess(validFen));
      } catch (e) {
        setGame(new Chess(STARTING_FEN));
      }
    }
  }, [fen]);

  const board = game.board();
  const squares = orientation === 'w' ? board : [...board].reverse().map(row => [...row].reverse());

  const handleSquareClick = (square: string) => {
    if (!activeTurn) return; // Prevent clicking if not your turn

    if (selectedSquare) {
      try {
        const move = game.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });
        
        if (move) {
          setGame(new Chess(game.fen()));
          onMove?.(move);
        }
        setSelectedSquare(null);
      } catch (e) {
        const piece = game.get(square as any);
        if (piece && piece.color === game.turn()) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
        }
      }
    } else {
      const piece = game.get(square as any);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
      }
    }
  };

  const getPieceImage = (type: string, color: string) => {
    return `https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/merida/${color}${type.toUpperCase()}.svg`;
  };

  return (
    <div className={`grid grid-cols-8 gap-0 border-[8px] border-[#1F1F1F] rounded shadow-2xl bg-[#0C0C0C] transition-all duration-300 ${activeTurn ? 'ring-4 ring-[#CCFF00]/40' : ''}`}>
      {squares.map((row, rIdx) => (
        row.map((cell, cIdx) => {
          const actualR = orientation === 'w' ? rIdx : 7 - rIdx;
          const actualC = orientation === 'w' ? cIdx : 7 - cIdx;
          const squareName = String.fromCharCode(97 + actualC) + (8 - actualR);
          const isDark = (actualR + actualC) % 2 === 1;
          const isSelected = selectedSquare === squareName;
          
          return (
            <div
              key={squareName}
              onClick={() => handleSquareClick(squareName)}
              className={`relative flex items-center justify-center cursor-pointer transition-colors duration-100 aspect-square
                ${isDark ? 'bg-[#739552]' : 'bg-[#EBECD0]'} 
                ${isSelected ? 'bg-yellow-500/60' : ''}
                hover:brightness-95 active:scale-[0.98]`}
            >
              {cell && (
                <img 
                  src={getPieceImage(cell.type, cell.color)} 
                  alt={`${cell.color} ${cell.type}`}
                  className="w-[90%] h-[90%] select-none drop-shadow-lg"
                />
              )}
              {/* Coordinates */}
              {actualC === 0 && (
                <span className={`absolute top-0.5 left-0.5 text-[8px] font-bold ${isDark ? 'text-[#EBECD0]' : 'text-[#739552]'}`}>
                  {8 - actualR}
                </span>
              )}
              {actualR === 7 && (
                <span className={`absolute bottom-0.5 right-0.5 text-[8px] font-bold ${isDark ? 'text-[#EBECD0]' : 'text-[#739552]'}`}>
                  {String.fromCharCode(97 + actualC)}
                </span>
              )}
            </div>
          );
        })
      ))}
    </div>
  );
};

export default ChessBoard;
