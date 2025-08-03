# BasicViewer Comparison Integration PRD

## 1. Executive Summary

### Project Goal
Integrate comparison functionality into the existing BasicViewer component to create a unified DICOM viewing experience that supports both single-study viewing and multi-study comparison within the same interface.

### Business Justification
- **Unified User Experience**: Single interface for all viewing modes reduces learning curve
- **Reduced Code Complexity**: Eliminate duplicate functionality across multiple viewer components
- **Better Resource Management**: Centralized study/series data management
- **Industry Alignment**: Follows patterns established by commercial DICOM viewers

### Success Metrics
- Single codebase for basic and comparison viewing
- Zero regression in existing BasicViewer functionality
- Smooth transition between single and comparison modes
- Performance comparable to existing separate viewers

## 2. Current State Analysis

### Existing Architecture Issues
1. **Data Fragmentation**: BasicViewer uses `seriesData[]`, ComparisonViewer uses separate study selection
2. **Code Duplication**: Tool panels, headers, and basic functionality replicated
3. **Complex State Management**: AppContainer manages 47+ props across multiple viewers
4. **Inconsistent UX**: Different interfaces for similar functionality

### User Workflow Problems
1. Mode switching loses current study context
2. Different tool interfaces between basic and comparison modes
3. Study loading process varies between viewers
4. Synchronization settings not persistent across mode changes

## 3. Target User Personas

### Primary Users
1. **Radiologists**: Need quick comparison between current and prior studies
2. **Medical Residents**: Learning anatomy through side-by-side comparison
3. **Clinical Specialists**: Monitoring disease progression over time

### Use Cases
1. **Single Study Review**: Standard diagnostic workflow
2. **Prior Comparison**: Current vs previous study comparison
3. **Multi-Series Analysis**: Different sequences/modalities of same study
4. **Temporal Analysis**: Disease progression over multiple time points

## 4. Product Requirements

### 4.1 Functional Requirements

#### FR-1: Unified Mode Management
- **FR-1.1**: Single viewer component supporting 1, 2, or 4 viewports
- **FR-1.2**: Seamless transition between viewport configurations
- **FR-1.3**: Preserve current study when switching modes
- **FR-1.4**: Remember user's preferred layout per session

#### FR-2: Layout System
- **FR-2.1**: Support 1x1 (single), 1x2 (side-by-side), and 2x2 (quad) layouts
- **FR-2.2**: Visual layout selector with preview icons
- **FR-2.3**: Responsive viewport sizing based on available space
- **FR-2.4**: Drag & drop series assignment to specific viewports

#### FR-3: Study/Series Management
- **FR-3.1**: Unified series browser supporting multi-study selection
- **FR-3.2**: Drag & drop series thumbnails into viewports
- **FR-3.3**: Color-coded study organization in sidebar
- **FR-3.4**: Quick actions for loading series into comparison slots

#### FR-4: Viewport Synchronization
- **FR-4.1**: Window/Level synchronization with toggle
- **FR-4.2**: Zoom/Pan synchronization with toggle
- **FR-4.3**: Slice/Scroll synchronization with anatomical mapping
- **FR-4.4**: Cross-reference lines for spatial correlation
- **FR-4.5**: Synchronization settings persistent across sessions

#### FR-5: Viewport Management
- **FR-5.1**: Active viewport highlighting (border/indicator)
- **FR-5.2**: Viewport identification (letters A, B, C, D)
- **FR-5.3**: Individual tool selection per viewport
- **FR-5.4**: Right-click context menu for viewport actions

### 4.2 Non-Functional Requirements

#### NFR-1: Performance
- **NFR-1.1**: Viewport switching < 100ms
- **NFR-1.2**: Study loading performance equal to current BasicViewer
- **NFR-1.3**: Memory usage < 150% of single-viewport mode
- **NFR-1.4**: Support up to 4 simultaneous DICOM series

#### NFR-2: Usability
- **NFR-2.1**: Zero learning curve for existing BasicViewer users
- **NFR-2.2**: Keyboard shortcuts for all major actions
- **NFR-2.3**: Visual feedback for all synchronization states
- **NFR-2.4**: Error recovery without losing viewport contents

#### NFR-3: Compatibility
- **NFR-3.1**: Maintain all existing BasicViewer props/interfaces
- **NFR-3.2**: Support all current DICOM SOP classes
- **NFR-3.3**: Preserve all existing annotation/measurement tools
- **NFR-3.4**: Backward compatibility with existing data formats

## 5. Technical Architecture

### 5.1 Component Hierarchy
```
BasicViewer (enhanced)
├── Header (existing)
│   ├── ModeSelector (existing)
│   ├── LayoutSelector (new)
│   └── ThemeToggle (existing)
├── ToolPanel (existing, enhanced)
│   ├── NavigationTools (existing)
│   ├── MeasurementTools (existing)
│   ├── AnnotationTools (existing)
│   └── SynchronizationControls (new)
├── MainContent
│   ├── ViewportGrid (new)
│   │   ├── DicomViewport (1-4 instances)
│   │   └── ViewportManager (new)
│   └── EmptyState (existing)
└── Sidebar (enhanced)
    ├── StudiesPanel (enhanced)
    ├── SeriesPanel (enhanced)
    └── SyncPanel (new)
```

### 5.2 Data Model Changes
```typescript
interface EnhancedBasicViewerProps {
  // Existing props (unchanged)
  currentMode: string;
  setCurrentMode: (mode: string) => void;
  seriesData: DicomSeries[];
  selectedSeries: number;
  activeTool: string;
  // ... other existing props

  // New comparison props
  viewportLayout: '1x1' | '1x2' | '2x2';
  setViewportLayout: (layout: string) => void;
  comparisonSeries: (number | null)[];
  setComparisonSeries: (series: (number | null)[]) => void;
  syncSettings: SynchronizationSettings;
  setSyncSettings: (settings: SynchronizationSettings) => void;
}

interface SynchronizationSettings {
  enableZoom: boolean;
  enablePan: boolean;
  enableScroll: boolean;
  enableWindowLevel: boolean;
  enableReferenceLines: boolean;
  enableSliceSync: boolean;
  enableAnatomicalMapping: boolean;
}

interface ViewportState {
  id: string;
  seriesIndex: number | null;
  isActive: boolean;
  activeTool: string;
  windowLevel?: { width: number; center: number };
  zoom?: number;
  pan?: { x: number; y: number };
}
```

### 5.3 Integration Strategy

#### Phase 1: Foundation (Week 1-2)
1. **Viewport Grid System**: Implement flexible viewport container
2. **Layout Selector**: Add layout switching UI to toolbar
3. **Enhanced Sidebar**: Extend series panel for multi-selection
4. **Basic Multi-Viewport**: Support 1x2 layout with independent series

#### Phase 2: Synchronization (Week 3-4)
1. **Sync Controls**: Add synchronization toggles to toolbar
2. **Viewport Synchronizer**: Integrate existing sync utilities
3. **Cross-Reference**: Implement basic crosshair synchronization
4. **State Management**: Unified viewport state handling

#### Phase 3: Polish & Performance (Week 5-6)
1. **Drag & Drop**: Series thumbnail drag-and-drop assignment
2. **Keyboard Shortcuts**: Implement power-user shortcuts
3. **Performance Optimization**: Memory and rendering optimization
4. **Error Handling**: Robust error recovery mechanisms

## 6. User Experience Design

### 6.1 Layout Transition Flow
```
Single Mode (1x1):
[Header with Layout Selector]
[Tool Panel] [Main Viewport        ] [Sidebar]
[           ] [                     ] [       ]

Comparison Mode (1x2):
[Header with Layout Selector + Sync Controls]
[Tool Panel] [Viewport A] [Viewport B] [Sidebar]
[           ] [         ] [          ] [       ]

Quad Mode (2x2):
[Header with Layout Selector + Sync Controls]
[Tool] [Viewport A] [Viewport B] [Sidebar]
[Panel] [Viewport C] [Viewport D] [       ]
```

### 6.2 Interaction Patterns

#### Layout Switching
1. **Visual Selector**: Grid icons showing 1x1, 1x2, 2x2 layouts
2. **Smooth Transition**: Animated viewport reconfiguration
3. **Context Preservation**: Current series remains in primary viewport
4. **Quick Access**: Keyboard shortcuts (1, 2, 4 keys)

#### Series Assignment
1. **Drag & Drop**: Thumbnail → specific viewport
2. **Double-Click**: Load into active viewport
3. **Context Menu**: Right-click viewport for series selection
4. **Color Coding**: Study-based color coding in sidebar

#### Synchronization Control
1. **Toggle Buttons**: Individual sync features in toolbar
2. **Sync Status**: Visual indicators for active synchronization
3. **Master Toggle**: Enable/disable all sync features
4. **Per-Viewport Control**: Advanced per-viewport sync settings

## 7. Migration Strategy

### 7.1 Backward Compatibility
- All existing BasicViewer props remain unchanged
- Default behavior matches current single-viewport mode
- Optional comparison props with sensible defaults
- Gradual feature adoption without breaking changes

### 7.2 Component Deprecation Path
1. **Phase 1**: BasicViewer enhanced, ComparisonViewer marked deprecated
2. **Phase 2**: ComparisonViewer functionality fully integrated
3. **Phase 3**: ComparisonViewer component removed
4. **Phase 4**: AppContainer simplified to use single viewer

### 7.3 Data Migration
```typescript
// Current AppContainer state
const [selectedSeries, setSelectedSeries] = useState(0);
const [comparisonStudyA, setComparisonStudyA] = useState(null);
const [comparisonStudyB, setComparisonStudyB] = useState(null);

// Migrated state
const [viewportLayout, setViewportLayout] = useState('1x1');
const [comparisonSeries, setComparisonSeries] = useState([selectedSeries, null, null, null]);
const [syncSettings, setSyncSettings] = useState(defaultSyncSettings);
```

## 8. Success Criteria

### 8.1 Functional Success
- [ ] All existing BasicViewer functionality preserved
- [ ] Smooth transitions between 1x1, 1x2, and 2x2 layouts
- [ ] Drag & drop series assignment working
- [ ] All synchronization features functional
- [ ] Viewport identification and management working

### 8.2 Performance Success
- [ ] Layout switching < 100ms
- [ ] No memory leaks in multi-viewport mode
- [ ] Rendering performance ≥ 95% of single-viewport
- [ ] Stable operation with 4 simultaneous series

### 8.3 User Experience Success
- [ ] Zero regressions in single-viewport workflow
- [ ] Intuitive comparison mode discovery
- [ ] Consistent tool behavior across all viewports
- [ ] Effective visual feedback for all interactions

## 9. Risks and Mitigation

### 9.1 Technical Risks
**Risk**: Performance degradation with multiple viewports
**Mitigation**: Implement viewport-level rendering optimization and memory management

**Risk**: State management complexity
**Mitigation**: Use established patterns from existing StudyComparison implementation

**Risk**: Cornerstone3D synchronization issues
**Mitigation**: Leverage proven ViewportSynchronizer utility from Phase 1.3

### 9.2 User Experience Risks
**Risk**: Feature discoverability
**Mitigation**: Progressive disclosure with clear visual cues and tooltips

**Risk**: Mode switching confusion
**Mitigation**: Consistent UI patterns and user testing validation

## 10. Implementation Timeline

### Week 1-2: Foundation
- Enhanced BasicViewer component structure
- Viewport grid system implementation
- Layout selector UI component
- Basic 1x2 layout support

### Week 3-4: Core Features
- Synchronization controls integration
- Drag & drop series assignment
- Cross-reference line implementation
- Advanced viewport management

### Week 5-6: Polish & Integration
- Performance optimization
- Error handling and edge cases
- Keyboard shortcuts
- Final AppContainer integration

### Week 7: Testing & Validation
- User acceptance testing
- Performance benchmarking
- Bug fixes and refinements
- Documentation updates

## 11. Appendix

### A. Competitive Analysis Summary
Based on research of OHIF, Weasis, 3D Slicer, and commercial viewers:
- Standard layouts: 1x1, 1x2, 2x2 as primary options
- Drag & drop as preferred series assignment method
- Toggle-based synchronization controls
- Visual viewport identification (letters/colors)

### B. Technical Dependencies
- Cornerstone3D v3.x for viewport rendering
- Existing ViewportSynchronizer utility
- shadcn/ui for consistent component styling
- React 18+ with TypeScript for component structure

### C. Open Questions
1. Should we support 3x3 or larger grids in future versions?
2. How should we handle mixed modality comparisons?
3. What preset layouts should we provide for common use cases?
4. Should synchronization settings be global or per-comparison session?