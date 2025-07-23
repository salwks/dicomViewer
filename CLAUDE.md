# Cornerstone3D DICOM Viewer - Development Guide

## Project Overview

Advanced medical imaging viewer built on Cornerstone3D v3.x architecture providing comprehensive DICOM visualization, annotation, measurement, and analysis capabilities for healthcare professionals.

## Key Features

### Core Capabilities
- **DICOM Loading & Display**: Support for 95+ DICOM SOP classes
- **Multi-viewport Management**: Stack and volume viewport rendering
- **Annotation Tools**: Length, angle, area measurements with mm precision
- **Volume Rendering**: 3D visualization with MPR support
- **Security**: Medical-grade security and HIPAA compliance

### Technology Stack
- **Frontend**: React 18+ with TypeScript 5+
- **Rendering**: Cornerstone3D v3.x
- **Build Tool**: Vite with TypeScript
- **State Management**: Zustand
- **Medical Imaging**: CornerstoneJS Tools for annotations

## Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run preview         # Preview production build

# Code Quality
npm run lint            # Run ESLint
npm run type-check      # TypeScript checking
```

## Project Structure

```
src/
├── components/         # React components
│   ├── DicomViewer.tsx    # Main DICOM viewer
│   ├── Viewport.tsx       # Viewport management
│   └── Toolbar.tsx        # Tool selection
├── core/              # Cornerstone3D integration
│   ├── init.ts           # Cornerstone initialization
│   ├── imageLoader.ts    # DICOM image loading
│   └── viewport.ts       # Viewport management
├── tools/             # Annotation tools
│   ├── measurementTools.ts
│   └── annotationManager.ts
├── utils/             # Utilities
└── types/             # TypeScript definitions
```

## Core Dependencies

```json
{
  "@cornerstonejs/core": "^1.77.9",
  "@cornerstonejs/tools": "^1.77.9", 
  "@cornerstonejs/dicom-image-loader": "^1.77.9",
  "react": "^18.2.0",
  "typescript": "^5.2.2"
}
```

## Security Considerations

- Medical-grade security headers
- Input validation and sanitization
- XSS protection mechanisms
- HIPAA compliance measures
- Secure DICOM data handling

## Performance Requirements

- **Initial Load**: <3 seconds for application startup
- **Image Loading**: <2 seconds for average DICOM image  
- **Viewport Rendering**: 60fps for smooth interactions
- **Memory Usage**: <2GB for typical study viewing

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
