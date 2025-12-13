/**
 * UI store using Zustand
 * UI 상태 관리 스토어 (모달, 사이드바, 테마 등)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

type ModalType =
  | 'inventory'
  | 'shop'
  | 'quest'
  | 'guild'
  | 'settings'
  | 'profile'
  | null;

interface UIState {
  // Modals
  activeModal: ModalType;
  modalProps: Record<string, any>;
  
  // Sidebar
  isSidebarOpen: boolean;
  
  // Toast notifications (managed by toast component, but state here for coordination)
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
  }>;
  
  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;
  
  // Theme (for future dark mode support)
  theme: 'light' | 'dark';
  
  // Actions
  openModal: (type: ModalType, props?: Record<string, any>) => void;
  closeModal: () => void;
  
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  setLoading: (loading: boolean, message?: string | null) => void;
  
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial state
      activeModal: null,
      modalProps: {},
      isSidebarOpen: false,
      toasts: [],
      isLoading: false,
      loadingMessage: null,
      theme: 'light',

      // Modal actions
      openModal: (type, props = {}) => {
        set({
          activeModal: type,
          modalProps: props,
        });
      },

      closeModal: () => {
        set({
          activeModal: null,
          modalProps: {},
        });
      },

      // Sidebar actions
      toggleSidebar: () => {
        set((state) => ({
          isSidebarOpen: !state.isSidebarOpen,
        }));
      },

      setSidebarOpen: (open) => {
        set({ isSidebarOpen: open });
      },

      // Toast actions
      addToast: (message, type = 'info', duration = 3000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        const toast = {
          id,
          message,
          type,
          duration,
        };
        
        set((state) => ({
          toasts: [...state.toasts, toast],
        }));

        // Auto remove after duration
        if (duration > 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, duration);
        }

        return id;
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },

      clearToasts: () => {
        set({ toasts: [] });
      },

      // Loading actions
      setLoading: (loading, message = null) => {
        set({
          isLoading: loading,
          loadingMessage: message,
        });
      },

      // Theme actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', theme === 'dark');
        }
      },

      toggleTheme: () => {
        const currentTheme = get().theme;
        get().setTheme(currentTheme === 'light' ? 'dark' : 'light');
      },
    }),
    {
      name: 'ui-store',
    }
  )
);

