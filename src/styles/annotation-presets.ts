/**
 * Annotation Style Presets
 *
 * Pre-defined styling configurations for different annotation types
 * Optimized for medical imaging workflows and visual clarity
 */

import {
  AnnotationStyling,
  AnnotationStylePreset,
  AnnotationStyleCategory,
  AnnotationType,
  DEFAULT_COLORS,
  DEFAULT_FONTS,
} from '../types/annotation-styling';

/**
 * Generate consistent ID for presets
 */
const generatePresetId = (type: string, variant: string): string => {
  return `preset-${type}-${variant}`;
};

/**
 * Create base styling template
 */
const createBaseStyle = (overrides: Partial<AnnotationStyling> = {}): AnnotationStyling => ({
  id: '',
  name: '',
  description: '',
  line: {
    width: 2,
    color: DEFAULT_COLORS.PRIMARY,
    style: 'solid',
    cap: 'round',
    join: 'round',
  },
  fill: {
    color: { ...DEFAULT_COLORS.PRIMARY, rgba: [0, 123, 255, 0.2] },
    opacity: 0.2,
    pattern: 'solid',
  },
  font: { ...DEFAULT_FONTS.PRIMARY },
  opacity: 1.0,
  visible: true,
  zIndex: 100,
  scaleFactor: 1.0,
  category: AnnotationStyleCategory.CUSTOM,
  compatibleTypes: [],
  isPreset: true,
  isReadonly: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  version: '1.0.0',
  tags: [],
  // Selection styling
  selected: {
    line: {
      width: 3,
      color: DEFAULT_COLORS.WARNING,
      style: 'solid',
      cap: 'round',
      join: 'round',
    },
    shadow: {
      color: DEFAULT_COLORS.WARNING,
      blur: 6,
      offsetX: 0,
      offsetY: 0,
      opacity: 0.5,
    },
  },
  // Hover styling
  hover: {
    line: {
      width: 2.5,
      color: DEFAULT_COLORS.PRIMARY,
      style: 'solid',
      cap: 'round',
      join: 'round',
    },
    opacity: 0.8,
  },
  ...overrides,
});

/* =============================================================================
 * MEASUREMENT TOOL PRESETS
 * ============================================================================= */

/**
 * Length Measurement Presets
 */
export const LENGTH_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('length', 'standard'),
    name: 'Standard Length',
    description: 'Professional measurement with clear visibility',
    category: AnnotationStyleCategory.MEASUREMENT,
    popularity: 95,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('length', 'standard'),
      name: 'Standard Length',
      compatibleTypes: [AnnotationType.LENGTH, AnnotationType.RULER],
      line: {
        width: 2,
        color: DEFAULT_COLORS.PRIMARY,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 14,
        weight: 'bold',
      },
      measurementPrecision: 2,
      unitDisplay: {
        show: true,
        format: 'short',
        position: 'inline',
      },
      tags: ['length', 'measurement', 'standard'],
    }),
  },
  {
    id: generatePresetId('length', 'clinical'),
    name: 'Clinical Length',
    description: 'High contrast for clinical precision',
    category: AnnotationStyleCategory.MEASUREMENT,
    popularity: 90,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('length', 'clinical'),
      name: 'Clinical Length',
      compatibleTypes: [AnnotationType.LENGTH],
      line: {
        width: 3,
        color: DEFAULT_COLORS.DANGER,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 16,
        weight: 'bold',
      },
      shadow: {
        color: DEFAULT_COLORS.BLACK,
        blur: 2,
        offsetX: 1,
        offsetY: 1,
        opacity: 0.3,
      },
      measurementPrecision: 1,
      unitDisplay: {
        show: true,
        format: 'long',
        position: 'inline',
      },
      tags: ['length', 'clinical', 'high-contrast'],
    }),
  },
];

/**
 * Angle Measurement Presets
 */
export const ANGLE_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('angle', 'standard'),
    name: 'Standard Angle',
    description: 'Clear angle measurement with arc display',
    category: AnnotationStyleCategory.MEASUREMENT,
    popularity: 85,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('angle', 'standard'),
      name: 'Standard Angle',
      compatibleTypes: [AnnotationType.ANGLE],
      line: {
        width: 2,
        color: DEFAULT_COLORS.SUCCESS,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: { ...DEFAULT_COLORS.SUCCESS, rgba: [40, 167, 69, 0.15] },
        opacity: 0.15,
        pattern: 'solid',
      },
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 14,
        weight: 'bold',
      },
      measurementPrecision: 1,
      unitDisplay: {
        show: true,
        format: 'short',
        position: 'inline',
      },
      tags: ['angle', 'measurement', 'standard'],
    }),
  },
];

/**
 * Area Measurement Presets
 */
export const AREA_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('area', 'standard'),
    name: 'Standard Area',
    description: 'Area measurement with transparent fill',
    category: AnnotationStyleCategory.MEASUREMENT,
    popularity: 80,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('area', 'standard'),
      name: 'Standard Area',
      compatibleTypes: [AnnotationType.AREA],
      line: {
        width: 2,
        color: DEFAULT_COLORS.WARNING,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: { ...DEFAULT_COLORS.WARNING, rgba: [255, 193, 7, 0.25] },
        opacity: 0.25,
        pattern: 'solid',
      },
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 14,
        weight: 'bold',
      },
      measurementPrecision: 2,
      unitDisplay: {
        show: true,
        format: 'short',
        position: 'inline',
      },
      tags: ['area', 'measurement', 'standard'],
    }),
  },
];

/* =============================================================================
 * ROI TOOL PRESETS
 * ============================================================================= */

/**
 * Rectangle ROI Presets
 */
export const RECTANGLE_ROI_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('rectangle', 'standard'),
    name: 'Standard Rectangle',
    description: 'Standard rectangular region of interest',
    category: AnnotationStyleCategory.ROI,
    popularity: 90,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('rectangle', 'standard'),
      name: 'Standard Rectangle',
      compatibleTypes: [AnnotationType.RECTANGLE],
      line: {
        width: 2,
        color: DEFAULT_COLORS.PRIMARY,
        style: 'solid',
        cap: 'square',
        join: 'miter',
      },
      fill: {
        color: { ...DEFAULT_COLORS.PRIMARY, rgba: [0, 123, 255, 0.1] },
        opacity: 0.1,
        pattern: 'solid',
      },
      tags: ['rectangle', 'roi', 'standard'],
    }),
  },
  {
    id: generatePresetId('rectangle', 'highlight'),
    name: 'Highlight Rectangle',
    description: 'High visibility rectangular ROI',
    category: AnnotationStyleCategory.ROI,
    popularity: 75,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('rectangle', 'highlight'),
      name: 'Highlight Rectangle',
      compatibleTypes: [AnnotationType.RECTANGLE],
      line: {
        width: 3,
        color: DEFAULT_COLORS.WARNING,
        style: 'dashed',
        dashPattern: [10, 5],
        cap: 'square',
        join: 'miter',
      },
      fill: {
        color: { ...DEFAULT_COLORS.WARNING, rgba: [255, 193, 7, 0.2] },
        opacity: 0.2,
        pattern: 'solid',
      },
      animation: {
        type: 'pulse',
        duration: 2000,
        iterations: 'infinite',
        timing: 'ease-in-out',
      },
      tags: ['rectangle', 'roi', 'highlight', 'animated'],
    }),
  },
];

/**
 * Ellipse ROI Presets
 */
export const ELLIPSE_ROI_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('ellipse', 'standard'),
    name: 'Standard Ellipse',
    description: 'Standard elliptical region of interest',
    category: AnnotationStyleCategory.ROI,
    popularity: 85,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('ellipse', 'standard'),
      name: 'Standard Ellipse',
      compatibleTypes: [AnnotationType.ELLIPSE],
      line: {
        width: 2,
        color: DEFAULT_COLORS.SUCCESS,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: { ...DEFAULT_COLORS.SUCCESS, rgba: [40, 167, 69, 0.15] },
        opacity: 0.15,
        pattern: 'solid',
      },
      tags: ['ellipse', 'roi', 'standard'],
    }),
  },
];

/* =============================================================================
 * DRAWING TOOL PRESETS
 * ============================================================================= */

/**
 * Arrow Presets
 */
export const ARROW_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('arrow', 'standard'),
    name: 'Standard Arrow',
    description: 'Clear directional indicator',
    category: AnnotationStyleCategory.DRAWING,
    popularity: 85,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('arrow', 'standard'),
      name: 'Standard Arrow',
      compatibleTypes: [AnnotationType.ARROW],
      line: {
        width: 3,
        color: DEFAULT_COLORS.DANGER,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      tags: ['arrow', 'drawing', 'standard'],
    }),
  },
  {
    id: generatePresetId('arrow', 'attention'),
    name: 'Attention Arrow',
    description: 'High visibility attention indicator',
    category: AnnotationStyleCategory.DRAWING,
    popularity: 70,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('arrow', 'attention'),
      name: 'Attention Arrow',
      compatibleTypes: [AnnotationType.ARROW],
      line: {
        width: 4,
        color: DEFAULT_COLORS.WARNING,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      shadow: {
        color: DEFAULT_COLORS.BLACK,
        blur: 4,
        offsetX: 2,
        offsetY: 2,
        opacity: 0.4,
      },
      animation: {
        type: 'glow',
        duration: 1500,
        iterations: 'infinite',
        timing: 'ease-in-out',
      },
      tags: ['arrow', 'drawing', 'attention', 'animated'],
    }),
  },
];

/**
 * Freehand Drawing Presets
 */
export const FREEHAND_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('freehand', 'sketch'),
    name: 'Sketch Style',
    description: 'Natural freehand sketching',
    category: AnnotationStyleCategory.DRAWING,
    popularity: 75,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('freehand', 'sketch'),
      name: 'Sketch Style',
      compatibleTypes: [AnnotationType.FREEHAND],
      line: {
        width: 2,
        color: DEFAULT_COLORS.SECONDARY,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      tags: ['freehand', 'drawing', 'sketch'],
    }),
  },
  {
    id: generatePresetId('freehand', 'highlight'),
    name: 'Highlight Marker',
    description: 'Bright highlighting style',
    category: AnnotationStyleCategory.DRAWING,
    popularity: 65,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('freehand', 'highlight'),
      name: 'Highlight Marker',
      compatibleTypes: [AnnotationType.FREEHAND],
      line: {
        width: 8,
        color: { rgb: [255, 255, 0], hex: '#ffff00' },
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      opacity: 0.6,
      tags: ['freehand', 'drawing', 'highlight'],
    }),
  },
];

/* =============================================================================
 * TEXT ANNOTATION PRESETS
 * ============================================================================= */

/**
 * Text Annotation Presets
 */
export const TEXT_PRESETS: AnnotationStylePreset[] = [
  {
    id: generatePresetId('text', 'standard'),
    name: 'Standard Text',
    description: 'Clear readable text annotation',
    category: AnnotationStyleCategory.TEXT,
    popularity: 90,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('text', 'standard'),
      name: 'Standard Text',
      compatibleTypes: [AnnotationType.TEXT],
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 16,
        weight: 'normal',
      },
      line: {
        width: 1,
        color: DEFAULT_COLORS.BLACK,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: DEFAULT_COLORS.WHITE,
        opacity: 0.9,
        pattern: 'solid',
      },
      shadow: {
        color: DEFAULT_COLORS.BLACK,
        blur: 2,
        offsetX: 1,
        offsetY: 1,
        opacity: 0.3,
      },
      tags: ['text', 'annotation', 'standard'],
    }),
  },
  {
    id: generatePresetId('text', 'title'),
    name: 'Title Text',
    description: 'Large title-style text',
    category: AnnotationStyleCategory.TEXT,
    popularity: 70,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('text', 'title'),
      name: 'Title Text',
      compatibleTypes: [AnnotationType.TEXT],
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 24,
        weight: 'bold',
      },
      line: {
        width: 2,
        color: DEFAULT_COLORS.PRIMARY,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: DEFAULT_COLORS.WHITE,
        opacity: 0.95,
        pattern: 'solid',
      },
      shadow: {
        color: DEFAULT_COLORS.BLACK,
        blur: 3,
        offsetX: 2,
        offsetY: 2,
        opacity: 0.4,
      },
      tags: ['text', 'annotation', 'title', 'large'],
    }),
  },
  {
    id: generatePresetId('text', 'callout'),
    name: 'Callout Text',
    description: 'Attention-grabbing callout style',
    category: AnnotationStyleCategory.TEXT,
    popularity: 60,
    isUserCreated: false,
    styling: createBaseStyle({
      id: generatePresetId('text', 'callout'),
      name: 'Callout Text',
      compatibleTypes: [AnnotationType.TEXT],
      font: {
        ...DEFAULT_FONTS.PRIMARY,
        size: 18,
        weight: 'bold',
      },
      line: {
        width: 3,
        color: DEFAULT_COLORS.WARNING,
        style: 'solid',
        cap: 'round',
        join: 'round',
      },
      fill: {
        color: { rgb: [255, 248, 220], hex: '#fff8dc' },
        opacity: 0.95,
        pattern: 'solid',
      },
      shadow: {
        color: DEFAULT_COLORS.BLACK,
        blur: 4,
        offsetX: 2,
        offsetY: 2,
        opacity: 0.5,
      },
      tags: ['text', 'annotation', 'callout', 'attention'],
    }),
  },
];

/* =============================================================================
 * PRESET COLLECTIONS
 * ============================================================================= */

/**
 * All available presets organized by category
 */
export const ALL_PRESETS: AnnotationStylePreset[] = [
  ...LENGTH_PRESETS,
  ...ANGLE_PRESETS,
  ...AREA_PRESETS,
  ...RECTANGLE_ROI_PRESETS,
  ...ELLIPSE_ROI_PRESETS,
  ...ARROW_PRESETS,
  ...FREEHAND_PRESETS,
  ...TEXT_PRESETS,
];

/**
 * Presets organized by category
 */
export const PRESETS_BY_CATEGORY = {
  [AnnotationStyleCategory.MEASUREMENT]: [
    ...LENGTH_PRESETS,
    ...ANGLE_PRESETS,
    ...AREA_PRESETS,
  ],
  [AnnotationStyleCategory.ROI]: [
    ...RECTANGLE_ROI_PRESETS,
    ...ELLIPSE_ROI_PRESETS,
  ],
  [AnnotationStyleCategory.DRAWING]: [
    ...ARROW_PRESETS,
    ...FREEHAND_PRESETS,
  ],
  [AnnotationStyleCategory.TEXT]: TEXT_PRESETS,
  [AnnotationStyleCategory.PRESET]: ALL_PRESETS,
  [AnnotationStyleCategory.CUSTOM]: [],
};

/**
 * Get presets by annotation type
 */
export const getPresetsByType = (type: AnnotationType): AnnotationStylePreset[] => {
  return ALL_PRESETS.filter(preset => 
    preset.styling.compatibleTypes.includes(type)
  ).sort((a, b) => b.popularity - a.popularity);
};

/**
 * Get preset by ID
 */
export const getPresetById = (id: string): AnnotationStylePreset | null => {
  return ALL_PRESETS.find(preset => preset.id === id) || null;
};

/**
 * Get most popular presets
 */
export const getPopularPresets = (limit: number = 10): AnnotationStylePreset[] => {
  return ALL_PRESETS
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit);
};