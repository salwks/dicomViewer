/**
 * Tool Panel Constants
 */

// Tool types based on Cornerstone3D tools
export enum ToolType {
  // Navigation
  ZOOM = 'zoom',
  PAN = 'pan',
  ROTATE = 'rotate',
  STACK_SCROLL = 'stackScroll',

  // Windowing
  WINDOW_LEVEL = 'windowLevel',

  // Measurement
  LENGTH = 'length',
  ANGLE = 'angle',
  RECTANGLE_ROI = 'rectangleROI',
  ELLIPSE_ROI = 'ellipseROI',
  ARROW = 'arrow',

  // Annotation
  TEXT = 'text',
  FREEHAND = 'freehand',

  // Segmentation
  BRUSH = 'brush',
  THRESHOLD = 'threshold',
  REGION_GROWING = 'regionGrowing',

  // 3D
  VOLUME_ROTATE = 'volumeRotate',
  CROSSHAIRS = 'crosshairs',
}

export enum ToolCategory {
  NAVIGATION = 'navigation',
  WINDOWING = 'windowing',
  MEASUREMENT = 'measurement',
  ANNOTATION = 'annotation',
  SEGMENTATION = 'segmentation',
  VOLUME_3D = 'volume3d',
}
