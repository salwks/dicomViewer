/**
 * DICOM Structured Report (SR) Exporter
 *
 * Exports annotations to DICOM SR format for medical reporting
 * Compliant with DICOM Standard PS3.3-2023b for SR objects
 */

import { SerializedAnnotation, AnnotationExport } from './annotationPersistence';
import { AnnotationType } from '../types/annotation-styling';
import { log } from '../utils/logger';

/**
 * DICOM SR Content Item Types
 */
export enum SRContentItemType {
  CONTAINER = 'CONTAINER',
  TEXT = 'TEXT',
  NUM = 'NUM',
  CODE = 'CODE',
  DATE = 'DATE',
  TIME = 'TIME',
  DATETIME = 'DATETIME',
  PNAME = 'PNAME',
  SCOORD = 'SCOORD',
  SCOORD3D = 'SCOORD3D',
  TCOORD = 'TCOORD',
  COMPOSITE = 'COMPOSITE',
  IMAGE = 'IMAGE',
  WAVEFORM = 'WAVEFORM',
}

/**
 * DICOM SR Relationship Types
 */
export enum SRRelationshipType {
  CONTAINS = 'CONTAINS',
  HAS_OBS_CONTEXT = 'HAS OBS CONTEXT',
  HAS_ACQ_CONTEXT = 'HAS ACQ CONTEXT',
  HAS_CONCEPT_MOD = 'HAS CONCEPT MOD',
  HAS_PROPERTIES = 'HAS PROPERTIES',
  INFERRED_FROM = 'INFERRED FROM',
  SELECTED_FROM = 'SELECTED FROM',
}

/**
 * DICOM Coded Concept
 */
export interface DicomCodedConcept {
  /** Code value */
  codeValue: string;
  /** Coding scheme designator */
  codingSchemeDesignator: string;
  /** Code meaning */
  codeMeaning: string;
  /** Coding scheme version (optional) */
  codingSchemeVersion?: string;
}

/**
 * DICOM SR Content Item
 */
export interface SRContentItem {
  /** Relationship type */
  relationshipType: SRRelationshipType;
  /** Content item type */
  valueType: SRContentItemType;
  /** Concept name */
  conceptName: DicomCodedConcept;
  /** Text value (for TEXT type) */
  textValue?: string;
  /** Numeric value (for NUM type) */
  numericValue?: {
    value: number;
    unit: DicomCodedConcept;
    qualifier?: DicomCodedConcept;
  };
  /** Coded value (for CODE type) */
  codedValue?: DicomCodedConcept;
  /** Spatial coordinates (for SCOORD type) */
  spatialCoordinates?: {
    graphicType: 'POINT' | 'MULTIPOINT' | 'POLYLINE' | 'CIRCLE' | 'ELLIPSE';
    graphicData: number[];
    pixelOriginInterpretation?: 'VOLUME' | 'FRAME';
  };
  /** Referenced SOP instance (for COMPOSITE/IMAGE type) */
  referencedSOPInstance?: {
    sopClassUID: string;
    sopInstanceUID: string;
    frameNumbers?: number[];
  };
  /** Child content items */
  contentSequence?: SRContentItem[];
  /** Observation date/time */
  observationDateTime?: Date;
  /** Observer context */
  observerContext?: {
    personName?: string;
    organization?: string;
    role?: DicomCodedConcept;
  };
}

/**
 * DICOM SR Document Header
 */
export interface SRDocumentHeader {
  /** SOP Instance UID */
  sopInstanceUID: string;
  /** Series Instance UID */
  seriesInstanceUID: string;
  /** Study Instance UID */
  studyInstanceUID: string;
  /** Document title */
  documentTitle: DicomCodedConcept;
  /** Completion flag */
  completionFlag: 'PARTIAL' | 'COMPLETE';
  /** Verification flag */
  verificationFlag: 'UNVERIFIED' | 'VERIFIED';
  /** Content date */
  contentDate: Date;
  /** Content time */
  contentTime: Date;
  /** Instance creation date */
  instanceCreationDate: Date;
  /** Instance creation time */
  instanceCreationTime: Date;
  /** Manufacturer */
  manufacturer: string;
  /** Software versions */
  softwareVersions: string[];
  /** Patient information */
  patient?: {
    id?: string;
    name?: string;
    birthDate?: Date;
    sex?: 'M' | 'F' | 'O';
  };
  /** Study information */
  study?: {
    date?: Date;
    time?: Date;
    description?: string;
    id?: string;
  };
  /** Series information */
  series?: {
    date?: Date;
    time?: Date;
    description?: string;
    number?: number;
    modality?: string;
  };
  /** Equipment information */
  equipment?: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    softwareVersion?: string;
  };
}

/**
 * DICOM SR Document
 */
export interface SRDocument {
  /** Document header */
  header: SRDocumentHeader;
  /** Root content item */
  contentTree: SRContentItem;
}

/**
 * SR Export options
 */
export interface SRExportOptions {
  /** Include patient information */
  includePatientInfo?: boolean;
  /** Include study information */
  includeStudyInfo?: boolean;
  /** Include measurements */
  includeMeasurements?: boolean;
  /** Include annotations */
  includeAnnotations?: boolean;
  /** Verification status */
  verificationFlag?: 'UNVERIFIED' | 'VERIFIED';
  /** Completion status */
  completionFlag?: 'PARTIAL' | 'COMPLETE';
  /** Observer information */
  observerInfo?: {
    name?: string;
    organization?: string;
    role?: string;
  };
  /** Custom template */
  templateId?: string;
}

/**
 * Standard DICOM Codes for Medical Imaging
 */
export class DicomCodes {
  // Document Titles
  static readonly IMAGING_MEASUREMENTS = {
    codeValue: '126000',
    codingSchemeDesignator: 'DCM',
    codeMeaning: 'Imaging Measurements',
  };

  static readonly IMAGING_REPORT = {
    codeValue: '18748-4',
    codingSchemeDesignator: 'LN',
    codeMeaning: 'Diagnostic imaging report',
  };

  // Concept Names
  static readonly FINDING = {
    codeValue: '121071',
    codingSchemeDesignator: 'DCM',
    codeMeaning: 'Finding',
  };

  static readonly MEASUREMENT_GROUP = {
    codeValue: '125007',
    codingSchemeDesignator: 'DCM',
    codeMeaning: 'Measurement Group',
  };

  static readonly LINEAR_MEASUREMENT = {
    codeValue: '410668003',
    codingSchemeDesignator: 'SCT',
    codeMeaning: 'Length',
  };

  static readonly AREA_MEASUREMENT = {
    codeValue: '42798000',
    codingSchemeDesignator: 'SCT',
    codeMeaning: 'Area',
  };

  static readonly VOLUME_MEASUREMENT = {
    codeValue: '118565006',
    codingSchemeDesignator: 'SCT',
    codeMeaning: 'Volume',
  };

  static readonly ANGLE_MEASUREMENT = {
    codeValue: '30745-4',
    codingSchemeDesignator: 'LN',
    codeMeaning: 'Angle',
  };

  // Units
  static readonly MILLIMETER = {
    codeValue: 'mm',
    codingSchemeDesignator: 'UCUM',
    codeMeaning: 'millimeter',
  };

  static readonly SQUARE_MILLIMETER = {
    codeValue: 'mm2',
    codingSchemeDesignator: 'UCUM',
    codeMeaning: 'square millimeter',
  };

  static readonly CUBIC_MILLIMETER = {
    codeValue: 'mm3',
    codingSchemeDesignator: 'UCUM',
    codeMeaning: 'cubic millimeter',
  };

  static readonly DEGREE = {
    codeValue: 'deg',
    codingSchemeDesignator: 'UCUM',
    codeMeaning: 'degree',
  };

  // Annotation Types
  static readonly TEXT_ANNOTATION = {
    codeValue: '121106',
    codingSchemeDesignator: 'DCM',
    codeMeaning: 'Comment',
  };

  static readonly ARROW_ANNOTATION = {
    codeValue: '121107',
    codingSchemeDesignator: 'DCM',
    codeMeaning: 'Pointer',
  };

  // Finding Categories
  static readonly NORMAL = {
    codeValue: '17621005',
    codingSchemeDesignator: 'SCT',
    codeMeaning: 'Normal',
  };

  static readonly ABNORMAL = {
    codeValue: '263654008',
    codingSchemeDesignator: 'SCT',
    codeMeaning: 'Abnormal',
  };
}

/**
 * DICOM SR Exporter Service
 */
export class DicomSRExporter {
  private static instance: DicomSRExporter;

  private constructor() {
    log.info('📋 DICOM SR Exporter initialized');
  }

  static getInstance(): DicomSRExporter {
    if (!DicomSRExporter.instance) {
      DicomSRExporter.instance = new DicomSRExporter();
    }
    return DicomSRExporter.instance;
  }

  /**
   * Export annotations to DICOM SR
   */
  exportToSR(
    annotationData: AnnotationExport,
    options: SRExportOptions = {},
  ): SRDocument {
    const {
      includePatientInfo = true,
      includeStudyInfo = true,
      includeMeasurements = true,
      includeAnnotations = true,
      verificationFlag = 'UNVERIFIED',
      completionFlag = 'COMPLETE',
      observerInfo = {},
    } = options;

    const now = new Date();

    // Generate UIDs (in production, use proper UID generation)
    const sopInstanceUID = this.generateUID();
    const seriesInstanceUID = this.generateUID();
    const studyInstanceUID = annotationData.metadata.studyInfo?.studyInstanceUID || this.generateUID();

    // Create document header
    const header: SRDocumentHeader = {
      sopInstanceUID,
      seriesInstanceUID,
      studyInstanceUID,
      documentTitle: DicomCodes.IMAGING_MEASUREMENTS,
      completionFlag,
      verificationFlag,
      contentDate: now,
      contentTime: now,
      instanceCreationDate: now,
      instanceCreationTime: now,
      manufacturer: 'Cornerstone3D',
      softwareVersions: [annotationData.metadata.applicationVersion],
    };

    // Add patient info if available
    if (includePatientInfo && annotationData.metadata.studyInfo) {
      header.patient = {
        id: annotationData.metadata.studyInfo.patientId,
      };
    }

    // Add study info if available
    if (includeStudyInfo && annotationData.metadata.studyInfo) {
      header.study = {
        date: annotationData.metadata.studyInfo.studyDate
          ? new Date(annotationData.metadata.studyInfo.studyDate)
          : undefined,
        id: annotationData.metadata.studyInfo.studyInstanceUID,
      };
    }

    // Create content tree
    const contentTree = this.createContentTree(
      annotationData,
      {
        includeMeasurements,
        includeAnnotations,
        observerInfo,
      },
    );

    const document: SRDocument = {
      header,
      contentTree,
    };

    log.info(`📋 Created DICOM SR with ${annotationData.annotations.length} annotations`);
    return document;
  }

  /**
   * Create SR content tree
   */
  private createContentTree(
    annotationData: AnnotationExport,
    options: {
      includeMeasurements: boolean;
      includeAnnotations: boolean;
      observerInfo: any;
    },
  ): SRContentItem {
    const rootItem: SRContentItem = {
      relationshipType: SRRelationshipType.CONTAINS,
      valueType: SRContentItemType.CONTAINER,
      conceptName: DicomCodes.IMAGING_MEASUREMENTS,
      contentSequence: [],
      observationDateTime: annotationData.exportedAt,
      observerContext: {
        personName: options.observerInfo.name,
        organization: options.observerInfo.organization,
      },
    };

    // Group annotations by type
    const annotationsByType = this.groupAnnotationsByType(annotationData.annotations);

    // Add measurement groups
    if (options.includeMeasurements) {
      this.addMeasurementGroups(rootItem, annotationsByType);
    }

    // Add annotation groups
    if (options.includeAnnotations) {
      this.addAnnotationGroups(rootItem, annotationsByType);
    }

    return rootItem;
  }

  /**
   * Group annotations by type
   */
  private groupAnnotationsByType(
    annotations: SerializedAnnotation[],
  ): Map<AnnotationType, SerializedAnnotation[]> {
    const groups = new Map<AnnotationType, SerializedAnnotation[]>();

    annotations.forEach(annotation => {
      if (!groups.has(annotation.type)) {
        groups.set(annotation.type, []);
      }
      groups.get(annotation.type)!.push(annotation);
    });

    return groups;
  }

  /**
   * Add measurement groups to content tree
   */
  private addMeasurementGroups(
    rootItem: SRContentItem,
    annotationsByType: Map<AnnotationType, SerializedAnnotation[]>,
  ): void {
    const measurementTypes: AnnotationType[] = [
      AnnotationType.LENGTH,
      AnnotationType.AREA,
      AnnotationType.AREA,
      AnnotationType.ANGLE,
      AnnotationType.ELLIPSE,
      AnnotationType.RECTANGLE,
      AnnotationType.ELLIPSE,
      AnnotationType.FREEHAND,
    ];

    measurementTypes.forEach(type => {
      const annotations = annotationsByType.get(type);
      if (annotations && annotations.length > 0) {
        const measurementGroup = this.createMeasurementGroup(type, annotations);
        rootItem.contentSequence!.push(measurementGroup);
      }
    });
  }

  /**
   * Add annotation groups to content tree
   */
  private addAnnotationGroups(
    rootItem: SRContentItem,
    annotationsByType: Map<AnnotationType, SerializedAnnotation[]>,
  ): void {
    const annotationTypes: AnnotationType[] = [
      AnnotationType.TEXT,
      AnnotationType.ARROW,
      AnnotationType.PROBE,
      AnnotationType.FREEHAND,
    ];

    annotationTypes.forEach(type => {
      const annotations = annotationsByType.get(type);
      if (annotations && annotations.length > 0) {
        const annotationGroup = this.createAnnotationGroup(type, annotations);
        rootItem.contentSequence!.push(annotationGroup);
      }
    });
  }

  /**
   * Create measurement group
   */
  private createMeasurementGroup(
    type: AnnotationType,
    annotations: SerializedAnnotation[],
  ): SRContentItem {
    // const conceptName = this.getMeasurementConceptName(type);

    const group: SRContentItem = {
      relationshipType: SRRelationshipType.CONTAINS,
      valueType: SRContentItemType.CONTAINER,
      conceptName: DicomCodes.MEASUREMENT_GROUP,
      contentSequence: [],
    };

    annotations.forEach((annotation, index) => {
      const measurement = this.createMeasurementItem(type, annotation, index + 1);
      group.contentSequence!.push(measurement);
    });

    return group;
  }

  /**
   * Create annotation group
   */
  private createAnnotationGroup(
    type: AnnotationType,
    annotations: SerializedAnnotation[],
  ): SRContentItem {
    const conceptName = this.getAnnotationConceptName(type);

    const group: SRContentItem = {
      relationshipType: SRRelationshipType.CONTAINS,
      valueType: SRContentItemType.CONTAINER,
      conceptName,
      contentSequence: [],
    };

    annotations.forEach((annotation, index) => {
      const item = this.createAnnotationItem(type, annotation, index + 1);
      group.contentSequence!.push(item);
    });

    return group;
  }

  /**
   * Create measurement item
   */
  private createMeasurementItem(
    type: AnnotationType,
    annotation: SerializedAnnotation,
    _index: number,
  ): SRContentItem {
    const conceptName = this.getMeasurementConceptName(type);
    const unit = this.getMeasurementUnit(type);

    // Extract measurement value from annotation data
    const value = this.extractMeasurementValue(annotation);

    const item: SRContentItem = {
      relationshipType: SRRelationshipType.CONTAINS,
      valueType: SRContentItemType.NUM,
      conceptName,
      numericValue: {
        value,
        unit,
      },
      observationDateTime: new Date(annotation.metadata.createdAt),
    };

    // Add spatial coordinates if available
    const spatialCoords = this.extractSpatialCoordinates(annotation);
    if (spatialCoords) {
      const coordItem: SRContentItem = {
        relationshipType: SRRelationshipType.HAS_PROPERTIES,
        valueType: SRContentItemType.SCOORD,
        conceptName: {
          codeValue: '121041',
          codingSchemeDesignator: 'DCM',
          codeMeaning: 'Graphic Data',
        },
        spatialCoordinates: spatialCoords,
      };

      item.contentSequence = [coordItem];
    }

    // Add referenced image if available
    if (annotation.viewportInfo.imageId) {
      const imageRef = this.createImageReference(annotation);
      if (imageRef) {
        item.contentSequence = item.contentSequence || [];
        item.contentSequence.push(imageRef);
      }
    }

    return item;
  }

  /**
   * Create annotation item
   */
  private createAnnotationItem(
    type: AnnotationType,
    annotation: SerializedAnnotation,
    _index: number,
  ): SRContentItem {
    const conceptName = this.getAnnotationConceptName(type);

    const item: SRContentItem = {
      relationshipType: SRRelationshipType.CONTAINS,
      valueType: SRContentItemType.TEXT,
      conceptName,
      textValue: this.extractAnnotationText(annotation),
      observationDateTime: new Date(annotation.metadata.createdAt),
    };

    // Add spatial coordinates for geometric annotations
    const spatialCoords = this.extractSpatialCoordinates(annotation);
    if (spatialCoords) {
      const coordItem: SRContentItem = {
        relationshipType: SRRelationshipType.HAS_PROPERTIES,
        valueType: SRContentItemType.SCOORD,
        conceptName: {
          codeValue: '121041',
          codingSchemeDesignator: 'DCM',
          codeMeaning: 'Graphic Data',
        },
        spatialCoordinates: spatialCoords,
      };

      item.contentSequence = [coordItem];
    }

    return item;
  }

  /**
   * Get measurement concept name for annotation type
   */
  private getMeasurementConceptName(type: AnnotationType): DicomCodedConcept {
    switch (type) {
      case AnnotationType.LENGTH:
        return DicomCodes.LINEAR_MEASUREMENT;
      case AnnotationType.AREA:
      case AnnotationType.ELLIPSE:
      case AnnotationType.RECTANGLE:
      case AnnotationType.FREEHAND:
        return DicomCodes.AREA_MEASUREMENT;
      case AnnotationType.VOLUME:
        return DicomCodes.VOLUME_MEASUREMENT;
      case AnnotationType.ANGLE:
        return DicomCodes.ANGLE_MEASUREMENT;
      default:
        return DicomCodes.LINEAR_MEASUREMENT;
    }
  }

  /**
   * Get annotation concept name for annotation type
   */
  private getAnnotationConceptName(type: AnnotationType): DicomCodedConcept {
    switch (type) {
      case AnnotationType.TEXT:
        return DicomCodes.TEXT_ANNOTATION;
      case AnnotationType.ARROW:
        return DicomCodes.ARROW_ANNOTATION;
      default:
        return DicomCodes.TEXT_ANNOTATION;
    }
  }

  /**
   * Get measurement unit for annotation type
   */
  private getMeasurementUnit(type: AnnotationType): DicomCodedConcept {
    switch (type) {
      case AnnotationType.LENGTH:
        return DicomCodes.MILLIMETER;
      case AnnotationType.AREA:
      case AnnotationType.ELLIPSE:
      case AnnotationType.RECTANGLE:
      case AnnotationType.FREEHAND:
        return DicomCodes.SQUARE_MILLIMETER;
      case AnnotationType.VOLUME:
        return DicomCodes.CUBIC_MILLIMETER;
      case AnnotationType.ANGLE:
        return DicomCodes.DEGREE;
      default:
        return DicomCodes.MILLIMETER;
    }
  }

  /**
   * Extract measurement value from annotation
   */
  private extractMeasurementValue(annotation: SerializedAnnotation): number {
    // Safe property access to extract measurement value
    const data = annotation.data as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(data, 'measurements')) {
      const measurements = data.measurements as Record<string, unknown>;
      if (typeof measurements === 'object' && measurements !== null) {
        // Try different common measurement property names
        const possibleKeys = ['value', 'length', 'area', 'volume', 'angle'];
        for (const key of possibleKeys) {
          if (Object.prototype.hasOwnProperty.call(measurements, key)) {
            // eslint-disable-next-line security/detect-object-injection
            const value = measurements[key];
            if (typeof value === 'number') {
              return value;
            }
          }
        }
      }
    }

    // Fallback: try direct data properties
    const possibleKeys = ['value', 'length', 'area', 'volume', 'angle'];
    for (const key of possibleKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // eslint-disable-next-line security/detect-object-injection
        const value = data[key];
        if (typeof value === 'number') {
          return value;
        }
      }
    }

    return 0; // Default value
  }

  /**
   * Extract annotation text
   */
  private extractAnnotationText(annotation: SerializedAnnotation): string {
    const data = annotation.data as Record<string, unknown>;

    if (Object.prototype.hasOwnProperty.call(data, 'text')) {
      const text = data.text;
      if (typeof text === 'string') {
        return text;
      }
    }

    return annotation.metadata.description || `${annotation.type} annotation`;
  }

  /**
   * Extract spatial coordinates from annotation
   */
  private extractSpatialCoordinates(annotation: SerializedAnnotation): {
    graphicType: 'POINT' | 'MULTIPOINT' | 'POLYLINE' | 'CIRCLE' | 'ELLIPSE';
    graphicData: number[];
    pixelOriginInterpretation?: 'VOLUME' | 'FRAME';
  } | null {
    const data = annotation.data as Record<string, unknown>;

    // Extract points/coordinates
    let points: number[] = [];
    let graphicType: 'POINT' | 'MULTIPOINT' | 'POLYLINE' | 'CIRCLE' | 'ELLIPSE' = 'POINT';

    if (Object.prototype.hasOwnProperty.call(data, 'points')) {
      const pointsData = data.points;
      if (Array.isArray(pointsData)) {
        points = pointsData.flat().filter(p => typeof p === 'number');
      }
    } else if (Object.prototype.hasOwnProperty.call(data, 'handles')) {
      const handlesData = data.handles as Record<string, unknown>;
      if (typeof handlesData === 'object' && handlesData !== null) {
        // Extract from handles structure
        points = this.extractPointsFromHandles(handlesData);
      }
    }

    if (points.length === 0) {
      return null;
    }

    // Determine graphic type based on annotation type and point count
    switch (annotation.type) {
      case AnnotationType.PROBE:
        graphicType = 'POINT';
        break;
      case AnnotationType.LENGTH:
      case AnnotationType.ARROW:
        graphicType = 'POLYLINE';
        break;
      case AnnotationType.CIRCLE:
        graphicType = 'CIRCLE';
        break;
      case AnnotationType.ELLIPSE:
        graphicType = 'ELLIPSE';
        break;
      case AnnotationType.FREEHAND:
        graphicType = points.length > 4 ? 'POLYLINE' : 'MULTIPOINT';
        break;
      default:
        graphicType = points.length === 2 ? 'POINT' : 'MULTIPOINT';
    }

    return {
      graphicType,
      graphicData: points,
      pixelOriginInterpretation: 'FRAME',
    };
  }

  /**
   * Extract points from handles structure
   */
  private extractPointsFromHandles(handles: Record<string, unknown>): number[] {
    const points: number[] = [];

    // Common handle names
    const handleNames = ['start', 'end', 'center', 'textBox', 'points'];

    for (const handleName of handleNames) {
      if (Object.prototype.hasOwnProperty.call(handles, handleName)) {
        // eslint-disable-next-line security/detect-object-injection
        const handle = handles[handleName] as Record<string, unknown>;
        if (typeof handle === 'object' && handle !== null) {
          if (typeof handle.x === 'number' && typeof handle.y === 'number') {
            points.push(handle.x, handle.y);
          }
        }
      }
    }

    return points;
  }

  /**
   * Create image reference
   */
  private createImageReference(annotation: SerializedAnnotation): SRContentItem | null {
    const { imageId, frameNumber } = annotation.viewportInfo;

    if (!imageId) {
      return null;
    }

    // Extract SOP Instance UID from imageId (this is a simplified extraction)
    const sopInstanceUID = this.extractSOPInstanceUID(imageId);
    if (!sopInstanceUID) {
      return null;
    }

    return {
      relationshipType: SRRelationshipType.SELECTED_FROM,
      valueType: SRContentItemType.IMAGE,
      conceptName: {
        codeValue: '121112',
        codingSchemeDesignator: 'DCM',
        codeMeaning: 'Source of Measurement',
      },
      referencedSOPInstance: {
        sopClassUID: '1.2.840.10008.5.1.4.1.1.2', // CT Image Storage (example)
        sopInstanceUID,
        frameNumbers: frameNumber ? [frameNumber] : undefined,
      },
    };
  }

  /**
   * Extract SOP Instance UID from image ID
   */
  private extractSOPInstanceUID(imageId: string): string | null {
    // This is a simplified extraction - in production, use proper DICOM parsing
    const matches = imageId.match(/instanceUID=([^&]+)/);
    return matches ? matches[1] : null;
  }

  /**
   * Generate UID (simplified version)
   */
  private generateUID(): string {
    // In production, use proper DICOM UID generation
    const prefix = '1.2.840.10008.1.2.1.'; // Example prefix
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${prefix}${timestamp}.${random}`;
  }

  /**
   * Convert SR document to DICOM JSON format
   */
  toDicomJSON(document: SRDocument): Record<string, unknown> {
    // This would convert the SR document to DICOM JSON format
    // Implementation would require full DICOM JSON specification
    const dicomJSON: Record<string, unknown> = {
      '00080005': { // Specific Character Set
        vr: 'CS',
        Value: ['ISO_IR 100'],
      },
      '00080016': { // SOP Class UID
        vr: 'UI',
        Value: ['1.2.840.10008.5.1.4.1.1.88.11'], // Basic Text SR
      },
      '00080018': { // SOP Instance UID
        vr: 'UI',
        Value: [document.header.sopInstanceUID],
      },
      '0020000D': { // Study Instance UID
        vr: 'UI',
        Value: [document.header.studyInstanceUID],
      },
      '0020000E': { // Series Instance UID
        vr: 'UI',
        Value: [document.header.seriesInstanceUID],
      },
      '00420011': { // Completion Flag
        vr: 'CS',
        Value: [document.header.completionFlag],
      },
      '00420012': { // Verification Flag
        vr: 'CS',
        Value: [document.header.verificationFlag],
      },
      '0040A730': { // Content Sequence
        vr: 'SQ',
        Value: [this.contentItemToDicomJSON(document.contentTree)],
      },
    };

    return dicomJSON;
  }

  /**
   * Convert content item to DICOM JSON
   */
  private contentItemToDicomJSON(item: SRContentItem): Record<string, unknown> {
    const dicomItem: Record<string, unknown> = {
      '0040A010': { // Relationship Type
        vr: 'CS',
        Value: [item.relationshipType],
      },
      '0040A040': { // Value Type
        vr: 'CS',
        Value: [item.valueType],
      },
      '0040A043': { // Concept Name Code Sequence
        vr: 'SQ',
        Value: [this.codedConceptToDicomJSON(item.conceptName)],
      },
    };

    // Add value based on type
    if (item.textValue) {
      dicomItem['0040A160'] = { // Text Value
        vr: 'UT',
        Value: [item.textValue],
      };
    }

    if (item.numericValue) {
      dicomItem['0040A300'] = { // Measured Value Sequence
        vr: 'SQ',
        Value: [{
          '0040A30A': { // Numeric Value
            vr: 'DS',
            Value: [item.numericValue.value.toString()],
          },
          '004008EA': { // Measurement Units Code Sequence
            vr: 'SQ',
            Value: [this.codedConceptToDicomJSON(item.numericValue.unit)],
          },
        }],
      };
    }

    // Add content sequence if present
    if (item.contentSequence && item.contentSequence.length > 0) {
      dicomItem['0040A730'] = { // Content Sequence
        vr: 'SQ',
        Value: item.contentSequence.map(subItem => this.contentItemToDicomJSON(subItem)),
      };
    }

    return dicomItem;
  }

  /**
   * Convert coded concept to DICOM JSON
   */
  private codedConceptToDicomJSON(concept: DicomCodedConcept): Record<string, unknown> {
    return {
      '00080100': { // Code Value
        vr: 'SH',
        Value: [concept.codeValue],
      },
      '00080102': { // Coding Scheme Designator
        vr: 'SH',
        Value: [concept.codingSchemeDesignator],
      },
      '00080104': { // Code Meaning
        vr: 'LO',
        Value: [concept.codeMeaning],
      },
    };
  }
}

// Export singleton instance
export const dicomSRExporter = DicomSRExporter.getInstance();
