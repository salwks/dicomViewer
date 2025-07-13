# 🏥 Cornerstone3D DICOM Viewer

A powerful medical imaging viewer built with Cornerstone3D, featuring multi-viewport capabilities and advanced DICOM series comparison functionality.

## ✨ Features

### Core Features
- **DICOM File Loading**: Support for multiple DICOM file formats
- **Multi-Viewport System**: Dynamic layouts (1x1, 2x2, 1x3) with state preservation
- **Advanced Tools**: Measurement, annotation, and ROI tools
- **Window/Level Controls**: Preset and custom window/level adjustments
- **Viewport Navigation**: Pan, zoom, rotate, and flip functionality

### 🆕 Series Comparison (New!)
- **Side-by-Side Comparison**: Load and compare two different DICOM series
- **Synchronized Navigation**: Camera and VOI synchronization between viewports
- **Volume Rendering**: Advanced volume visualization capabilities
- **Real-time Sync Controls**: Toggle camera and window/level synchronization

## 🚀 Quick Start

### Installation
```bash
npm install
npm run build
```

### Basic Usage
```bash
npm run dev
```
Open `http://localhost:3001` in your browser.

### Series Comparison Usage
```javascript
import { SeriesComparator, createMockImageIds } from './components/SeriesComparator';

// Create comparator instance
const comparator = new SeriesComparator(containerElement);

// Load and compare two series
await comparator.loadAndCompareSeries({
    series1ImageIds: imageIds1,
    series2ImageIds: imageIds2,
    containerElement: viewportContainer,
    syncCamera: true,
    syncVOI: true
});

// Control synchronization
comparator.toggleCameraSync(true);
comparator.toggleVOISync(true);
```

## 📁 Project Structure

```
src/
├── components/
│   ├── DicomViewer.ts          # Main DICOM viewer component
│   ├── LayoutManager.ts        # Multi-viewport layout management
│   ├── SeriesComparator.ts     # 🆕 Series comparison functionality
│   └── WindowLevelPanel.ts     # Window/level controls
├── core/
│   ├── viewportManager.ts      # Viewport lifecycle management
│   └── synchronizationManager.ts # Multi-viewport synchronization
├── utils/
│   ├── imageStateManager.ts    # Image state preservation
│   ├── multiViewportTools.ts   # Tool group management
│   └── viewportCleanup.ts      # Memory management
└── tests/
    └── multiViewportTests.ts   # Automated test suite
```

## 🚀 Recent Problem Fixes

### Critical Issues Resolved ✅

**1. Mock Data Loading (CORS) Issues**
- **Problem**: `Cross origin requests are only supported for HTTP` errors when using `mock://` protocol
- **Solution**: Implemented custom `mockImageLoader` with proper Cornerstone3D interface
- **Files**: `src/utils/mockImageLoader.ts` - Custom image loader for mock data

**2. Data Destructuring Errors**
- **Problem**: `TypeError: Right side of assignment cannot be destructured`
- **Solution**: Enhanced error handling and proper mock data generation
- **Files**: `MockDataManager` class with comprehensive data validation

**3. Viewport Size Warnings**
- **Problem**: `Viewport is too small – 0 – 0` warnings
- **Solution**: Improved CSS sizing with proper min-width/min-height
- **Files**: Enhanced CSS in `public/index.html`

**4. UI State Management**
- **Problem**: Sidebar disappearing during series comparison
- **Solution**: Separate viewport containers for main and comparison modes
- **Files**: Dual viewport system with proper mode switching

**5. Multi-Viewport Tool Group Conflicts** ✅
- **Problem**: Annotation tools not working in multi-layout mode, forced W/L only
- **Solution**: Enhanced tool group management with mode-aware activation
- **Files**: `MultiViewportToolManager` improvements and `activateToolForCurrentMode` function

**6. Layout Switching Tool Issues** ✅
- **Problem**: Annotation tools not working after switching back from multi to single layout
- **Solution**: Proper tool group cleanup and reconnection for main viewer
- **Files**: Added `reconnectTools()` method to DicomViewer class

**7. Sidebar Responsive Issues** ✅
- **Problem**: Sidebar size not fixed, viewport taking 100% on different resolutions
- **Solution**: Fixed sidebar width with `flex-shrink: 0` and proper min/max width
- **Files**: Enhanced CSS with responsive design fixes

### New Features Added 🆕

**Mock Image Loader System**
```typescript
// Automatic mock data generation with realistic patterns
const mockData = MockDataManager.getInstance();
const imageIds = mockData.generateMockSeries('series1', 20);

// Custom loader registration
registerMockImageLoader();
```

**Enhanced UI Controls**
- **🏠 Exit Button**: Return to main viewer from comparison mode
- **Sidebar Preservation**: Annotation tools remain accessible
- **Mode Switching**: Seamless transition between viewers

**Smart Tool Management System**
```typescript
// Mode-aware tool activation
function activateToolForCurrentMode(toolName: string, toolId: string) {
    const currentLayout = layoutManager.getCurrentLayout();
    if (currentLayout === '1x1') {
        viewer.activateTool(toolName); // Main viewer tools
    } else {
        multiToolManager.activateTool(toolName); // Multi-viewport tools
    }
}
```

**Fixed Annotation Workflow**
- ✅ **1x1 Layout**: All annotation tools working with main viewer tool group
- ✅ **Multi-Layout**: Annotation tools working with multi-viewport tool group  
- ✅ **Layout Switch**: Proper tool group cleanup and reconnection
- ✅ **Sidebar Always Available**: Fixed width sidebar (300px) on all screen sizes

## 🔧 API Reference

### SeriesComparator Class

#### Constructor
```typescript
new SeriesComparator(containerElement: HTMLElement)
```

#### Main Methods

**loadAndCompareSeries(config: SeriesComparisonConfig)**
```typescript
interface SeriesComparisonConfig {
    series1ImageIds: string[];
    series2ImageIds: string[];
    containerElement: HTMLElement;
    syncCamera?: boolean;
    syncVOI?: boolean;
}
```

**toggleCameraSync(enabled: boolean)**
- Enable/disable camera synchronization between viewports

**toggleVOISync(enabled: boolean)**
- Enable/disable VOI (window/level) synchronization

**resetViewports()**
- Reset both viewports to default camera positions

### Helper Functions

**createMockImageIds(seriesName: string, imageCount: number)**
- Generate mock image IDs for testing and demonstration

## 🎯 Examples

### Basic Series Comparison
```javascript
// Load two series for comparison
const series1 = ['wadouri:series1/image1.dcm', 'wadouri:series1/image2.dcm'];
const series2 = ['wadouri:series2/image1.dcm', 'wadouri:series2/image2.dcm'];

await comparator.loadAndCompareSeries({
    series1ImageIds: series1,
    series2ImageIds: series2,
    containerElement: document.getElementById('viewport-container'),
    syncCamera: true,
    syncVOI: false
});
```

### Mock Data Example
```javascript
// Generate mock data for testing
const mockSeries1 = createMockImageIds('cardiac_ct', 20);
const mockSeries2 = createMockImageIds('cardiac_mri', 25);

await comparator.loadAndCompareSeries({
    series1ImageIds: mockSeries1,
    series2ImageIds: mockSeries2,
    containerElement: viewportContainer
});
```

## 🧪 Testing

Run the automated test suite:
```bash
# In the browser console or via the UI
runMultiViewportTests();
```

## 📖 Documentation

### Key Concepts

**LayoutManager**: Manages viewport layouts and dynamic viewport operations
- Supports multiple predefined layouts (1x1, 2x2, 1x3)
- Dynamic viewport creation, removal, and cloning
- State preservation during layout transitions

**ViewportManager**: Handles viewport lifecycle and rendering
- Viewport creation and registration
- Active viewport management
- Rendering coordination

**SynchronizationManager**: Coordinates viewport interactions
- Camera synchronization (pan, zoom, rotation)
- VOI synchronization (window/level)
- Selective sync group management

**SeriesComparator**: Advanced series comparison functionality
- 2x1 layout setup for side-by-side comparison
- Volume loading and viewport assignment
- Bidirectional synchronization controls

### Synchronization Guide

The synchronization system uses Cornerstone3D's built-in Synchronizer class:

```javascript
// Camera synchronization
const cameraSync = new Synchronizer('camera-sync', 'CAMERA_MODIFIED', () => {});
cameraSync.add({ renderingEngineId: 'engine-id', viewportId: 'viewport-1' });
cameraSync.add({ renderingEngineId: 'engine-id', viewportId: 'viewport-2' });

// VOI synchronization  
const voiSync = new Synchronizer('voi-sync', 'VOI_MODIFIED', () => {});
voiSync.add({ renderingEngineId: 'engine-id', viewportId: 'viewport-1' });
voiSync.add({ renderingEngineId: 'engine-id', viewportId: 'viewport-2' });
```

## 🔗 Cornerstone3D Resources

- **Official Documentation**: https://www.cornerstonejs.org/docs/
- **Synchronizers Guide**: https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/synchronizers
- **ToolGroups**: https://www.cornerstonejs.org/docs/concepts/cornerstone-tools/toolGroups
- **Viewports**: https://www.cornerstonejs.org/docs/concepts/cornerstone-core/viewports

## 🤝 Contributing

This viewer is built following Cornerstone3D best practices and architectural patterns. Contributions should maintain consistency with the existing codebase structure.

## 📄 License

This project is built on top of Cornerstone3D, which is licensed under the MIT License.

---

**Built with ❤️ using Cornerstone3D for medical imaging excellence**