/**
 * Tool Types and Constants
 * Shared types for tool system across the application
 */

import { safePropertyAccess } from '../lib/utils';

// Tool types based on Cornerstone3D tools
export enum ToolType {
  // Navigation
  ZOOM = 'zoom',
  PAN = 'pan',
  SELECTION = 'selection',
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

// Tool to Name mapping utility
export const TOOL_TYPE_TO_NAME_MAP: Record<ToolType, string> = {
  [ToolType.WINDOW_LEVEL]: 'WindowLevel',
  [ToolType.PAN]: 'Pan',
  [ToolType.ZOOM]: 'Zoom',
  [ToolType.LENGTH]: 'Length',
  [ToolType.ANGLE]: 'Angle',
  [ToolType.RECTANGLE_ROI]: 'Rectangle',
  [ToolType.ELLIPSE_ROI]: 'Ellipse',
  [ToolType.PROBE]: 'Probe',
  [ToolType.BIDIRECTIONAL]: 'Bidirectional',
  [ToolType.HEIGHT]: 'Height',
  [ToolType.ARROW]: 'Arrow',
  [ToolType.FREEHAND]: 'Freehand',
  [ToolType.STACK_SCROLL]: 'StackScroll',
  [ToolType.COBB_ANGLE]: 'CobbAngle',
  [ToolType.DRAG_PROBE]: 'DragProbe',
  [ToolType.SELECTION]: 'Selection',
  [ToolType.TEXT]: 'Text',
  [ToolType.SPLINE_ROI]: 'SplineROI',
  [ToolType.LIVEWIRE]: 'Livewire',
  [ToolType.KEY_IMAGE]: 'KeyImage',
  [ToolType.ERASER]: 'Eraser',
  [ToolType.VOLUME_ROTATE]: 'VolumeRotate',
  [ToolType.CROSSHAIRS]: 'Crosshairs',
  [ToolType.ROTATE]: 'Rotate',
};

// Name to Tool Type mapping utility
export const NAME_TO_TOOL_TYPE_MAP: Record<string, ToolType> = {
  WindowLevel: ToolType.WINDOW_LEVEL,
  Pan: ToolType.PAN,
  Zoom: ToolType.ZOOM,
  Length: ToolType.LENGTH,
  Angle: ToolType.ANGLE,
  Rectangle: ToolType.RECTANGLE_ROI,
  Ellipse: ToolType.ELLIPSE_ROI,
  Probe: ToolType.PROBE,
  Bidirectional: ToolType.BIDIRECTIONAL,
  Height: ToolType.HEIGHT,
  Arrow: ToolType.ARROW,
  Freehand: ToolType.FREEHAND,
  StackScroll: ToolType.STACK_SCROLL,
  CobbAngle: ToolType.COBB_ANGLE,
  DragProbe: ToolType.DRAG_PROBE,
  Selection: ToolType.SELECTION,
  Text: ToolType.TEXT,
  SplineROI: ToolType.SPLINE_ROI,
  Livewire: ToolType.LIVEWIRE,
  KeyImage: ToolType.KEY_IMAGE,
  Eraser: ToolType.ERASER,
  VolumeRotate: ToolType.VOLUME_ROTATE,
  Crosshairs: ToolType.CROSSHAIRS,
  Rotate: ToolType.ROTATE,
};

// Utility functions
export function getToolNameFromType(toolType: ToolType): string | null {
  return safePropertyAccess(TOOL_TYPE_TO_NAME_MAP, toolType) || null;
}

export function getToolTypeFromName(toolName: string | null): ToolType | undefined {
  if (!toolName) return undefined;
  // eslint-disable-next-line security/detect-object-injection -- Safe: toolName is validated string parameter from known mapping
  return NAME_TO_TOOL_TYPE_MAP[toolName];
}
