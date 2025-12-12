/**
 * Authentication store using Zustand
 */

import { create } from 'zustand';
import { getToken, setToken, removeToken } from '../lib/auth';

interface User {
  id: string;
  nickname: string;
  username?: string;
  email?: string;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isAuthenticated: getToken() !== null,
  
  login: (user: User, token: string) => {
    setToken(token);
    set({
      user,
      token,
      isAuthenticated: true,
    });
  },
  
  logout: () => {
    removeToken();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },
  
  setUser: (user: User) => {
    set({ user });
  },
  
  initialize: () => {
    const token = getToken();
    if (token) {
      set({ token, isAuthenticated: true });
      // User will be loaded via tRPC query
    }
  },
}));

