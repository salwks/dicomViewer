import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { isLoginEnabled } from "../utils/feature-flags";
import { Language, DEFAULT_LANGUAGE } from "../utils/i18n";

// UI store interface
export interface UIStoreState {
  // State
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  isLicenseModalOpen: boolean;
  isLoginEnabled: boolean;
  currentLanguage: Language;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleLicenseModal: () => void;
  setLicenseModalOpen: (open: boolean) => void;
  clearError: () => void;
  setLanguage: (language: Language) => void;
}

export const useUIStore = create<UIStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isLoading: false,
    error: null,
    sidebarOpen: true,
    isLicenseModalOpen: false,
    isLoginEnabled: isLoginEnabled(),
    currentLanguage: (localStorage.getItem('clarity-language') as Language) || DEFAULT_LANGUAGE,

    // Actions
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error, isLoading: false });
      if (error) {
        console.error("DICOM Viewer Error:", error);
      }
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarOpen: !state.sidebarOpen }));
    },

    setSidebarOpen: (open: boolean) => {
      set({ sidebarOpen: open });
    },

    toggleLicenseModal: () => {
      set((state) => ({ isLicenseModalOpen: !state.isLicenseModalOpen }));
    },

    setLicenseModalOpen: (open: boolean) => {
      set({ isLicenseModalOpen: open });
    },

    clearError: () => {
      set({ error: null });
    },

    setLanguage: (language: Language) => {
      set({ currentLanguage: language });
      // 언어 변경을 localStorage에 저장
      localStorage.setItem('clarity-language', language);
    },
  }))
);

// Selectors for better performance
export const selectIsLoading = (state: UIStoreState) => state.isLoading;
export const selectError = (state: UIStoreState) => state.error;
export const selectSidebarOpen = (state: UIStoreState) => state.sidebarOpen;
export const selectLicenseModalOpen = (state: UIStoreState) => state.isLicenseModalOpen;
export const selectIsLoginEnabled = (state: UIStoreState) => state.isLoginEnabled;
export const selectCurrentLanguage = (state: UIStoreState) => state.currentLanguage;