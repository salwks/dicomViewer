/**
 * Application State Management Hook
 * Manages all application state including mode, series data, and tool settings
 */

import { useState, useRef } from 'react';
import { DicomViewerRef } from '../components/DicomViewer';
import { ViewportSynchronizer } from '../utils/viewportSynchronizer';

export interface AppState {
  // Mode and navigation
  currentMode: string;
  setCurrentMode: (mode: string) => void;

  // Series management
  selectedSeries: number;
  setSelectedSeries: (index: number) => void;
  seriesData: any[];
  setSeriesData: (data: any[]) => void;

  // Comparison mode
  comparisonStudyA: number | null;
  setComparisonStudyA: (index: number | null) => void;
  comparisonStudyB: number | null;
  setComparisonStudyB: (index: number | null) => void;

  // UI state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  activeTool: string;
  setActiveTool: (tool: string) => void;

  // Comparison mode tools
  comparisonToolA: string;
  setComparisonToolA: (tool: string) => void;
  comparisonToolB: string;
  setComparisonToolB: (tool: string) => void;

  // Synchronization state
  syncScroll: boolean;
  setSyncScroll: React.Dispatch<React.SetStateAction<boolean>>;
  syncZoom: boolean;
  setSyncZoom: React.Dispatch<React.SetStateAction<boolean>>;
  syncWindowLevel: boolean;
  setSyncWindowLevel: React.Dispatch<React.SetStateAction<boolean>>;
  syncTools: boolean;
  setSyncTools: React.Dispatch<React.SetStateAction<boolean>>;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dicomViewerRef: React.RefObject<DicomViewerRef | null>;
  comparisonViewerARef: React.RefObject<DicomViewerRef | null>;
  comparisonViewerBRef: React.RefObject<DicomViewerRef | null>;
  synchronizerRef: React.MutableRefObject<{
    syncAtoB: ViewportSynchronizer;
    syncBtoA: ViewportSynchronizer;
  } | null>;
}

export const useAppState = (): AppState => {
  // Mode and navigation state
  const [currentMode, setCurrentMode] = useState('viewer');
  const [selectedSeries, setSelectedSeries] = useState(0);
  const [seriesData, setSeriesData] = useState<any[]>([]);

  // Comparison mode state
  const [comparisonStudyA, setComparisonStudyA] = useState<number | null>(null);
  const [comparisonStudyB, setComparisonStudyB] = useState<number | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [activeTool, setActiveTool] = useState('WindowLevel');

  // Comparison mode tools
  const [comparisonToolA, setComparisonToolA] = useState('WindowLevel');
  const [comparisonToolB, setComparisonToolB] = useState('WindowLevel');

  // Synchronization state
  const [syncScroll, setSyncScroll] = useState(true);
  const [syncZoom, setSyncZoom] = useState(true);
  const [syncWindowLevel, setSyncWindowLevel] = useState(true);
  const [syncTools, setSyncTools] = useState(true);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dicomViewerRef = useRef<DicomViewerRef>(null);
  const comparisonViewerARef = useRef<DicomViewerRef>(null);
  const comparisonViewerBRef = useRef<DicomViewerRef>(null);
  const synchronizerRef = useRef<{ syncAtoB: ViewportSynchronizer; syncBtoA: ViewportSynchronizer } | null>(null);

  return {
    // Mode and navigation
    currentMode,
    setCurrentMode,

    // Series management
    selectedSeries,
    setSelectedSeries,
    seriesData,
    setSeriesData,

    // Comparison mode
    comparisonStudyA,
    setComparisonStudyA,
    comparisonStudyB,
    setComparisonStudyB,

    // UI state
    isLoading,
    setIsLoading,
    activeTool,
    setActiveTool,

    // Comparison mode tools
    comparisonToolA,
    setComparisonToolA,
    comparisonToolB,
    setComparisonToolB,

    // Synchronization state
    syncScroll,
    setSyncScroll,
    syncZoom,
    setSyncZoom,
    syncWindowLevel,
    setSyncWindowLevel,
    syncTools,
    setSyncTools,

    // Refs
    fileInputRef,
    dicomViewerRef,
    comparisonViewerARef,
    comparisonViewerBRef,
    synchronizerRef,
  };
};
