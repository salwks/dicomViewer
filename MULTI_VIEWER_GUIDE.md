# Multi-Viewer DICOM System Guide

## Overview

The Multi-Viewer System allows users to view and interact with up to 4 DICOM files simultaneously in various layout configurations. Each viewer operates independently with its own annotations, viewport settings, and tool states.

## Features

### 🎯 Core Functionality
- **Multiple File Support**: Load and manage multiple DICOM files
- **Selection System**: Select up to 4 files with ordered selection (1, 2, 3, 4)
- **Dynamic Layouts**: Switch between 1×N (single row) and 2×N (grid) layouts
- **Independent Viewers**: Each viewer has its own annotations, zoom, pan, and tool states
- **Active Viewer System**: Tools apply only to the currently active viewer

### 📁 File Management
- **Multi-File Upload**: Drag and drop or select multiple DICOM files
- **File List**: View all uploaded files with loading status
- **Selection Controls**: Checkbox interface with order numbers
- **Auto-disable**: Checkboxes become disabled when 4 files are selected

### 🔧 Layout Modes

#### 1×N Layout (Single Row)
- **1 file**: 1×1 grid
- **2 files**: 1×2 grid (side by side)
- **3 files**: 1×3 grid (three in a row)
- **4 files**: 1×4 grid (four in a row)

#### 2×N Layout (Grid)
- **1 file**: 1×1 grid
- **2 files**: 1×2 grid (side by side)
- **3 files**: 2×2 grid (top-left, top-right, bottom-left)
- **4 files**: 2×2 grid (full grid)

### 🛠️ Tools and Interactions

#### Available Tools
- **Pan**: Move around the image
- **Zoom**: Zoom in/out of the image
- **Window/Level**: Adjust image contrast and brightness
- **Length**: Linear measurement tool
- **Angle**: Angle measurement tool
- **Rectangle ROI**: Rectangular region of interest
- **Ellipse ROI**: Elliptical region of interest
- **Probe**: Point information tool

#### Viewport Controls
- **Rotate**: Clockwise and counter-clockwise rotation
- **Flip**: Horizontal and vertical flipping
- **Invert**: Color inversion
- **Reset**: Reset viewport to default settings

### 🔄 State Management

#### Recoil Atoms
- `allFilesState`: All uploaded files with metadata
- `selectedFileIdsState`: Selected file IDs in order
- `layoutModeState`: Current layout mode (1×N or 2×N)
- `activeViewerIdState`: Currently active viewer ID
- `annotationsByViewerIdState`: Annotations for each viewer
- `toolStateByViewerIdState`: Tool states for each viewer
- `viewportSettingsByViewerIdState`: Viewport settings for each viewer

#### Independent Operation
Each viewer maintains its own:
- Zoom level and pan position
- Window/level settings
- Rotation and flip states
- Annotation data
- Active tool selection

## Usage Instructions

### 1. Access Multi-Viewer
- Click the "Multi-Viewer" button in the main application header
- Or navigate to `/multi-viewer` directly

### 2. Upload Files
- Click "Upload DICOM Files" in the sidebar
- Select multiple .dcm or .dicom files
- Files will appear in the file list with loading status

### 3. Select Files for Viewing
- Use checkboxes to select up to 4 files
- Files are numbered in selection order (1, 2, 3, 4)
- Unselected files become disabled when 4 are selected
- Click checkbox again to deselect

### 4. Choose Layout Mode
- Click "1×N" for single row layout
- Click "2×N" for grid layout
- Layout updates immediately

### 5. Interact with Viewers
- Click any viewer to activate it (blue border appears)
- Select tools from the toolbar
- Tools apply only to the active viewer
- Each viewer remembers its own settings

### 6. Use Keyboard Shortcuts
- **P**: Pan tool
- **Z**: Zoom tool
- **W**: Window/Level tool
- **L**: Length measurement
- **A**: Angle measurement
- **R**: Rectangle ROI
- **E**: Ellipse ROI
- **T**: Probe tool
- **Ctrl+A**: Select all files (up to 4)
- **Ctrl+D**: Deselect all files

## Technical Architecture

### Component Structure
```
MultiViewerApp (RecoilRoot)
├── MultiViewerSidebar (file management)
├── MultiViewerToolbar (tool selection)
└── ViewerLayout (dynamic grid)
    └── SingleViewer (individual viewers)
```

### State Flow
1. Files uploaded → `allFilesState`
2. User selects files → `selectedFileIdsState`
3. Layout mode selected → `layoutModeState`
4. User clicks viewer → `activeViewerIdState`
5. Tool selected → `toolStateByViewerIdState`
6. Annotations created → `annotationsByViewerIdState`

### Performance Considerations
- Each viewer has its own Cornerstone3D rendering engine
- Independent tool groups prevent cross-viewer interference
- Viewport settings are cached and restored
- Annotations are stored per-viewer for isolation

## Best Practices

### For Users
1. **Select files strategically**: Choose related images for comparison
2. **Use appropriate layout**: 1×N for sequential viewing, 2×N for comparison
3. **Activate before using tools**: Always click a viewer before using tools
4. **Manage file count**: Remove unused files to improve performance

### For Developers
1. **State isolation**: Each viewer maintains independent state
2. **Memory management**: Cleanup rendering engines on unmount
3. **Event handling**: Use viewer-specific event listeners
4. **Performance**: Lazy load and initialize viewers as needed

## Troubleshooting

### Common Issues
1. **Tools not working**: Ensure a viewer is active (blue border)
2. **Files not loading**: Check file format (.dcm, .dicom)
3. **Performance issues**: Reduce number of active viewers
4. **Annotations disappearing**: Each viewer has its own annotations

### Debug Information
- Check browser console for Cornerstone3D errors
- Verify file loading status in sidebar
- Ensure proper DICOM file format
- Check network requests for file loading

## Integration with Main App

The multi-viewer system is fully integrated with the main application:
- Shares the same Cornerstone3D configuration
- Uses the same security and error handling
- Maintains the same coding standards
- Follows the same architecture patterns

Access the multi-viewer system through the main navigation or by visiting `/multi-viewer` directly.