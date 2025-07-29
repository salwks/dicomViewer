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
  PROBE = 'probe',
  BIDIRECTIONAL = 'bidirectional',
  HEIGHT = 'height',
  COBB_ANGLE = 'cobbAngle',
  ARROW = 'arrow',

  // Annotation
  TEXT = 'text',
  FREEHAND = 'freehand',
  SPLINE_ROI = 'splineROI',
  LIVEWIRE = 'livewire',
  KEY_IMAGE = 'keyImage',
  DRAG_PROBE = 'dragProbe',
  ERASER = 'eraser',

  // Segmentation (not implemented)
  // BRUSH = 'brush',
  // RECTANGLE_SCISSORS = 'rectangleScissors',
  // CIRCLE_SCISSORS = 'circleScissors',

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
