/**
 * Game store using Zustand
 * 게임 상태 관리 스토어
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { BoardState } from '@sudam/game-logic';

// Game types based on tRPC router
export interface Game {
  id: string;
  status: 'pending' | 'active' | 'ended';
  category: string;
  data: any; // Game-specific data (boardState, moveHistory, etc.)
  isEnded?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface GameMove {
  x: number;
  y: number;
  player: 1 | 2;
  timestamp?: Date | string;
}

interface GameState {
  // Current game
  currentGame: Game | null;
  currentGameId: string | null;
  
  // Game list
  games: Game[];
  activeGames: Game[];
  pendingGames: Game[];
  endedGames: Game[];
  
  // Board state
  boardState: BoardState | null;
  currentPlayer: 1 | 2;
  moveHistory: GameMove[];
  captures: { 1: number; 2: number };
  
  // WebSocket connection
  isWebSocketConnected: boolean;
  
  // Actions
  setCurrentGame: (game: Game | null) => void;
  setCurrentGameId: (gameId: string | null) => void;
  updateGame: (gameId: string, updates: Partial<Game>) => void;
  
  // Game list management
  setGames: (games: Game[]) => void;
  addGame: (game: Game) => void;
  removeGame: (gameId: string) => void;
  updateGameInList: (gameId: string, updates: Partial<Game>) => void;
  
  // Board state management
  setBoardState: (boardState: BoardState | null) => void;
  setCurrentPlayer: (player: 1 | 2) => void;
  addMove: (move: GameMove) => void;
  setCaptures: (captures: { 1: number; 2: number }) => void;
  resetBoard: () => void;
  
  // WebSocket
  setWebSocketConnected: (connected: boolean) => void;
  
  // Utility
  getGameById: (gameId: string) => Game | undefined;
  clearCurrentGame: () => void;
  clearAll: () => void;
}

export const useGameStore = create<GameState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentGame: null,
      currentGameId: null,
      games: [],
      activeGames: [],
      pendingGames: [],
      endedGames: [],
      boardState: null,
      currentPlayer: 1,
      moveHistory: [],
      captures: { 1: 0, 2: 0 },
      isWebSocketConnected: false,

      // Current game actions
      setCurrentGame: (game) => {
        if (!game) {
          set({
            currentGame: null,
            currentGameId: null,
            boardState: null,
            moveHistory: [],
            captures: { 1: 0, 2: 0 },
          });
          return;
        }

        const gameData = game.data || {};
        set({
          currentGame: game,
          currentGameId: game.id,
          boardState: gameData.boardState || null,
          currentPlayer: gameData.currentPlayer || 1,
          moveHistory: gameData.moveHistory || [],
          captures: gameData.captures || { 1: 0, 2: 0 },
        });
      },

      setCurrentGameId: (gameId) => {
        set({ currentGameId: gameId });
      },

      updateGame: (gameId, updates) => {
        const state = get();
        if (state.currentGameId === gameId && state.currentGame) {
          const updatedGame = { ...state.currentGame, ...updates };
          state.setCurrentGame(updatedGame);
        }
        // Also update in list
        state.updateGameInList(gameId, updates);
      },

      // Game list management
      setGames: (games) => {
        set({
          games,
          activeGames: games.filter((g) => g.status === 'active'),
          pendingGames: games.filter((g) => g.status === 'pending'),
          endedGames: games.filter((g) => g.status === 'ended'),
        });
      },

      addGame: (game) => {
        const state = get();
        const games = [...state.games, game];
        state.setGames(games);
      },

      removeGame: (gameId) => {
        const state = get();
        const games = state.games.filter((g) => g.id !== gameId);
        state.setGames(games);
        
        // Clear current game if it was removed
        if (state.currentGameId === gameId) {
          state.clearCurrentGame();
        }
      },

      updateGameInList: (gameId, updates) => {
        const state = get();
        const games = state.games.map((g) =>
          g.id === gameId ? { ...g, ...updates } : g
        );
        state.setGames(games);
      },

      // Board state management
      setBoardState: (boardState) => {
        set({ boardState });
      },

      setCurrentPlayer: (player) => {
        set({ currentPlayer: player });
      },

      addMove: (move) => {
        const state = get();
        set({
          moveHistory: [...state.moveHistory, move],
        });
      },

      setCaptures: (captures) => {
        set({ captures });
      },

      resetBoard: () => {
        set({
          boardState: null,
          currentPlayer: 1,
          moveHistory: [],
          captures: { 1: 0, 2: 0 },
        });
      },

      // WebSocket
      setWebSocketConnected: (connected) => {
        set({ isWebSocketConnected: connected });
      },

      // Utility
      getGameById: (gameId) => {
        return get().games.find((g) => g.id === gameId);
      },

      clearCurrentGame: () => {
        set({
          currentGame: null,
          currentGameId: null,
          boardState: null,
          currentPlayer: 1,
          moveHistory: [],
          captures: { 1: 0, 2: 0 },
        });
      },

      clearAll: () => {
        set({
          currentGame: null,
          currentGameId: null,
          games: [],
          activeGames: [],
          pendingGames: [],
          endedGames: [],
          boardState: null,
          currentPlayer: 1,
          moveHistory: [],
          captures: { 1: 0, 2: 0 },
          isWebSocketConnected: false,
        });
      },
    }),
    {
      name: 'game-store',
    }
  )
);

