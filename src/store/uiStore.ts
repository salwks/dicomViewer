import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// UI store interface
export interface UIStoreState {
  // State
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  isLicenseModalOpen: boolean;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleLicenseModal: () => void;
  setLicenseModalOpen: (open: boolean) => void;
  clearError: () => void;
}

export const useUIStore = create<UIStoreState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isLoading: false,
    error: null,
    sidebarOpen: true,
    isLicenseModalOpen: false,

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
  }))
);

// Selectors for better performance
export const selectIsLoading = (state: UIStoreState) => state.isLoading;
export const selectError = (state: UIStoreState) => state.error;
export const selectSidebarOpen = (state: UIStoreState) => state.sidebarOpen;
export const selectLicenseModalOpen = (state: UIStoreState) => state.isLicenseModalOpen;