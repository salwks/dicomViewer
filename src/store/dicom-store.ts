import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { 
  DicomViewerState, 
  ViewportConfig, 
  LayoutType, 
  SeriesInfo, 
  ToolGroupConfig,
  AnnotationData,
  RequiredAnnotationData,
  WindowLevelConfig,
  WindowLevelPreset
} from '../types';

// Default window level presets
const defaultWindowLevelPresets: WindowLevelPreset[] = [
  { name: 'Abdomen', windowCenter: 60, windowWidth: 400 },
  { name: 'Bone', windowCenter: 400, windowWidth: 1000 },
  { name: 'Brain', windowCenter: 40, windowWidth: 80 },
  { name: 'Chest', windowCenter: -600, windowWidth: 1600 },
  { name: 'Lung', windowCenter: -600, windowWidth: 1600 },
  { name: 'Mediastinum', windowCenter: 50, windowWidth: 350 },
];

export const useDicomStore = create<DicomViewerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    viewports: new Map(),
    activeViewportId: null,
    layoutType: '1x1',
    
    loadedSeries: [],
    currentSeries: null,
    currentImageIndex: 0,
    
    activeTool: null,
    toolGroups: new Map(),
    
    annotations: [],
    selectedAnnotationUID: null,
    
    windowLevelPresets: defaultWindowLevelPresets,
    currentWindowLevel: null,
    
    isLoading: false,
    error: null,
    sidebarOpen: true,

    // Actions
    setActiveViewport: (viewportId: string) => {
      set({ activeViewportId: viewportId });
    },

    setLayout: (layout: LayoutType) => {
      const state = get();
      if (state.layoutType !== layout) {
        console.log(`Changing layout from ${state.layoutType} to ${layout}`);
        set({ layoutType: layout });
      }
    },

    loadSeries: (series: SeriesInfo) => {
      set((state) => {
        const existingIndex = state.loadedSeries.findIndex(
          s => s.seriesInstanceUID === series.seriesInstanceUID
        );
        
        let updatedSeries;
        if (existingIndex >= 0) {
          updatedSeries = [...state.loadedSeries];
          updatedSeries[existingIndex] = series;
        } else {
          updatedSeries = [...state.loadedSeries, series];
        }
        
        return {
          loadedSeries: updatedSeries,
          currentSeries: series,
          currentImageIndex: 0,
          isLoading: false,
          error: null
        };
      });
    },

    setActiveTool: (toolName: string) => {
      const currentTool = get().activeTool;
      if (currentTool !== toolName) {
        console.log(`Activating tool: ${toolName}`);
        set({ activeTool: toolName });
        
        // Tool activation will be handled by DicomRenderer through subscription
        // This ensures proper setToolActive and mouse binding integration
      }
    },

    // Tool state management for DicomRenderer integration
    activateToolInViewport: (toolName: string, toolGroupRef: any) => {
      if (!toolGroupRef?.current) {
        console.warn('No tool group available for tool activation');
        return false;
      }

      try {
        console.log(`Activating tool in viewport: ${toolName}`);

        // Define tool categories and their activation logic
        const annotationTools = ['Length', 'RectangleROI', 'EllipticalROI', 'ArrowAnnotate'];
        const basicTools = ['Pan', 'Zoom', 'WindowLevel'];

        // Reset all annotation tools to passive first
        annotationTools.forEach(tool => {
          try {
            toolGroupRef.current.setToolPassive(tool);
          } catch (e) {
            console.warn(`Failed to set ${tool} passive:`, e);
          }
        });

        // Activate the requested tool based on its type
        if (annotationTools.includes(toolName)) {
          // Annotation tools - set as active with primary mouse binding
          toolGroupRef.current.setToolActive(toolName, {
            bindings: [{ mouseButton: 1 }] // Primary mouse button (left click)
          });
          console.log(`✅ Annotation tool activated: ${toolName}`);
          
        } else if (basicTools.includes(toolName)) {
          // Basic tools are always active with their respective mouse bindings
          // Just ensure the store state is updated - the tools are already configured
          console.log(`✅ Basic tool selected: ${toolName} (already active)`);
          
        } else {
          console.warn(`Unknown tool: ${toolName}`);
          return false;
        }

        // Update store state to reflect successful activation
        set({ activeTool: toolName });
        return true;

      } catch (error) {
        console.error(`Failed to activate tool ${toolName}:`, error);
        return false;
      }
    },

    addAnnotation: (annotation: RequiredAnnotationData) => {
      // Ensure annotationUID is always present - fix for TS2345
      const annotationWithUID: AnnotationData = {
        ...annotation,
        annotationUID: annotation.annotationUID || uuidv4(),
      };

      set((state) => ({
        annotations: [...state.annotations, annotationWithUID],
        selectedAnnotationUID: annotationWithUID.annotationUID
      }));
      
      console.log(`Added annotation: ${annotationWithUID.annotationUID}`);
    },

    updateAnnotation: (annotationUID: string, updates: Partial<AnnotationData>) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== 'string' || !annotationUID) {
        console.error('Invalid annotationUID provided for update');
        return;
      }

      set((state) => ({
        annotations: state.annotations.map(ann => 
          ann.annotationUID === annotationUID 
            ? { ...ann, ...updates }
            : ann
        )
      }));
      
      console.log(`Updated annotation: ${annotationUID}`);
    },

    removeAnnotation: (annotationUID: string) => {
      // Ensure annotationUID is string type - fix for TS2345
      if (typeof annotationUID !== 'string' || !annotationUID) {
        console.error('Invalid annotationUID provided for removal');
        return;
      }

      set((state) => ({
        annotations: state.annotations.filter(ann => ann.annotationUID !== annotationUID),
        selectedAnnotationUID: state.selectedAnnotationUID === annotationUID 
          ? null 
          : state.selectedAnnotationUID
      }));
      
      console.log(`Removed annotation: ${annotationUID}`);
    },

    setWindowLevel: (config: WindowLevelConfig) => {
      set({ currentWindowLevel: config });
      console.log(`Window level set: C${config.windowCenter} W${config.windowWidth}`);
    },

    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    setError: (error: string | null) => {
      set({ error, isLoading: false });
      if (error) {
        console.error('DICOM Viewer Error:', error);
      }
    },

    toggleSidebar: () => {
      set((state) => ({ sidebarOpen: !state.sidebarOpen }));
    },
  }))
);

// Selectors for better performance
export const selectActiveViewport = (state: DicomViewerState) => state.activeViewportId;
export const selectCurrentSeries = (state: DicomViewerState) => state.currentSeries;
export const selectAnnotations = (state: DicomViewerState) => state.annotations;
export const selectActiveTool = (state: DicomViewerState) => state.activeTool;
export const selectWindowLevel = (state: DicomViewerState) => state.currentWindowLevel;
export const selectIsLoading = (state: DicomViewerState) => state.isLoading;
export const selectError = (state: DicomViewerState) => state.error;