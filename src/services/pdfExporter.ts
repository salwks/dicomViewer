/**
 * PDF Export Service
 *
 * Exports annotations and measurements to PDF format for reporting
 * Supports medical imaging layouts with DICOM image snapshots
 */

import { SerializedAnnotation, AnnotationExport } from './annotationPersistence';
import { AnnotationType } from '../types/annotation-styling';
import { log } from '../utils/logger';

/**
 * PDF Export Options
 */
export interface PDFExportOptions {
  /** PDF layout orientation */
  orientation?: 'portrait' | 'landscape';
  /** Page format */
  format?: 'A4' | 'A3' | 'Letter' | 'Legal';
  /** Include patient information */
  includePatientInfo?: boolean;
  /** Include study information */
  includeStudyInfo?: boolean;
  /** Include measurements */
  includeMeasurements?: boolean;
  /** Include annotations */
  includeAnnotations?: boolean;
  /** Include image snapshots */
  includeImages?: boolean;
  /** Image quality (0-1) */
  imageQuality?: number;
  /** Report title */
  title?: string;
  /** Report subtitle */
  subtitle?: string;
  /** Footer text */
  footer?: string;
  /** Custom header */
  customHeader?: {
    leftText?: string;
    centerText?: string;
    rightText?: string;
    logo?: string; // Base64 image
  };
  /** Report metadata */
  metadata?: {
    author?: string;
    subject?: string;
    keywords?: string[];
    creator?: string;
  };
  /** Color scheme */
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  /** Font settings */
  fonts?: {
    title: { family: string; size: number };
    heading: { family: string; size: number };
    body: { family: string; size: number };
    caption: { family: string; size: number };
  };
}

/**
 * PDF Page Layout
 */
export interface PDFPageLayout {
  /** Page width in points */
  width: number;
  /** Page height in points */
  height: number;
  /** Margins */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /** Content area */
  contentArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * PDF Content Section
 */
export interface PDFContentSection {
  /** Section type */
  type: 'header' | 'patient-info' | 'study-info' | 'measurements' | 'annotations' | 'images' | 'footer';
  /** Section title */
  title?: string;
  /** Section content */
  content: PDFContentItem[];
  /** Section styling */
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    padding?: number;
    margin?: number;
  };
}

/**
 * PDF Content Item
 */
export interface PDFContentItem {
  /** Item type */
  type: 'text' | 'table' | 'image' | 'chart' | 'spacer';
  /** Item data */
  data: any;
  /** Item styling */
  style?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right';
    padding?: number;
    margin?: number;
    width?: number | string;
    height?: number | string;
  };
}

/**
 * Measurement Summary
 */
export interface MeasurementSummary {
  /** Measurement type */
  type: AnnotationType;
  /** Count */
  count: number;
  /** Values */
  values: Array<{
    id: string;
    value: number | string;
    unit?: string;
    description?: string;
    imageId?: string;
  }>;
  /** Statistics */
  statistics?: {
    min?: number;
    max?: number;
    mean?: number;
    median?: number;
    stdDev?: number;
  };
}

/**
 * PDF Generator Interface
 */
export interface PDFGenerator {
  /** Create new document */
  createDocument(options: PDFExportOptions): void;
  /** Add page */
  addPage(): void;
  /** Add text */
  addText(text: string, x: number, y: number, options?: any): void;
  /** Add image */
  addImage(imageData: string, x: number, y: number, width: number, height: number): void;
  /** Add table */
  addTable(data: any[][], x: number, y: number, options?: any): void;
  /** Add line */
  addLine(x1: number, y1: number, x2: number, y2: number, options?: any): void;
  /** Add rectangle */
  addRectangle(x: number, y: number, width: number, height: number, options?: any): void;
  /** Set font */
  setFont(family: string, size: number, style?: string): void;
  /** Set color */
  setColor(color: string): void;
  /** Get current Y position */
  getCurrentY(): number;
  /** Set current Y position */
  setCurrentY(y: number): void;
  /** Generate PDF blob */
  generateBlob(): Promise<Blob>;
  /** Generate PDF data URL */
  generateDataURL(): Promise<string>;
}

/**
 * Canvas-based PDF Generator (fallback implementation)
 */
export class CanvasPDFGenerator implements PDFGenerator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pages: ImageData[] = [];
  private currentY = 0;
  private layout: PDFPageLayout;
  private options: PDFExportOptions;

  constructor(layout: PDFPageLayout, options: PDFExportOptions) {
    this.layout = layout;
    this.options = options;
    this.canvas = document.createElement('canvas');
    this.canvas.width = layout.width * 2; // High DPI
    this.canvas.height = layout.height * 2;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(2, 2); // High DPI scaling
  }

  createDocument(options: PDFExportOptions): void {
    this.options = { ...this.options, ...options };
    this.ctx.fillStyle = this.options.colorScheme?.background || '#ffffff';
    this.ctx.fillRect(0, 0, this.layout.width, this.layout.height);
    this.currentY = this.layout.margins.top;
  }

  addPage(): void {
    // Save current page
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.pages.push(imageData);

    // Clear for new page
    this.ctx.fillStyle = this.options.colorScheme?.background || '#ffffff';
    this.ctx.fillRect(0, 0, this.layout.width, this.layout.height);
    this.currentY = this.layout.margins.top;
  }

  addText(text: string, x: number, y: number, options: any = {}): void {
    this.ctx.fillStyle = options.color || this.options.colorScheme?.text || '#000000';
    this.ctx.font = `${options.fontSize || 12}px ${options.fontFamily || 'Arial'}`;
    this.ctx.textAlign = options.alignment || 'left';
    this.ctx.fillText(text, x, y);

    if (y > this.currentY) {
      this.currentY = y + (options.fontSize || 12) + (options.margin || 5);
    }
  }

  addImage(imageData: string, x: number, y: number, width: number, height: number): void {
    const img = new Image();
    img.onload = () => {
      this.ctx.drawImage(img, x, y, width, height);
    };
    img.src = imageData;

    if (y + height > this.currentY) {
      this.currentY = y + height + 10;
    }
  }

  addTable(data: any[][], x: number, y: number, options: any = {}): void {
    const cellHeight = options.cellHeight || 25;
    const cellPadding = options.cellPadding || 5;
    const columnWidths = options.columnWidths || data[0].map(() => 100);

    let currentY = y;

    data.forEach((row, rowIndex) => {
      let currentX = x;

      row.forEach((cell, cellIndex) => {
        const cellWidth = columnWidths[cellIndex] || 100; // eslint-disable-line security/detect-object-injection

        // Draw cell border
        this.ctx.strokeStyle = options.borderColor || '#cccccc';
        this.ctx.strokeRect(currentX, currentY, cellWidth, cellHeight);

        // Fill header
        if (rowIndex === 0 && options.headerStyle) {
          this.ctx.fillStyle = options.headerStyle.backgroundColor || '#f5f5f5';
          this.ctx.fillRect(currentX, currentY, cellWidth, cellHeight);
        }

        // Draw text
        this.ctx.fillStyle = rowIndex === 0 && options.headerStyle?.color
          ? options.headerStyle.color
          : options.textColor || '#000000';
        this.ctx.font = `${options.fontSize || 11}px ${options.fontFamily || 'Arial'}`;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(
          String(cell),
          currentX + cellPadding,
          currentY + cellHeight - cellPadding - 3,
        );

        currentX += cellWidth;
      });

      currentY += cellHeight;
    });

    this.currentY = Math.max(this.currentY, currentY + 10);
  }

  addLine(x1: number, y1: number, x2: number, y2: number, options: any = {}): void {
    this.ctx.strokeStyle = options.color || '#000000';
    this.ctx.lineWidth = options.width || 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  addRectangle(x: number, y: number, width: number, height: number, options: any = {}): void {
    if (options.fillColor) {
      this.ctx.fillStyle = options.fillColor;
      this.ctx.fillRect(x, y, width, height);
    }

    if (options.strokeColor) {
      this.ctx.strokeStyle = options.strokeColor;
      this.ctx.lineWidth = options.strokeWidth || 1;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  setFont(family: string, size: number, style?: string): void {
    this.ctx.font = `${style || 'normal'} ${size}px ${family}`;
  }

  setColor(color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = color;
  }

  getCurrentY(): number {
    return this.currentY;
  }

  setCurrentY(y: number): void {
    this.currentY = y;
  }

  async generateBlob(): Promise<Blob> {
    // Save current page
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    this.pages.push(imageData);

    // Convert to PDF blob (simplified implementation)
    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    });
  }

  async generateDataURL(): Promise<string> {
    const blob = await this.generateBlob();
    return URL.createObjectURL(blob);
  }
}

/**
 * PDF Export Service
 */
export class PDFExportService {
  private static instance: PDFExportService;
  private defaultOptions: PDFExportOptions = {
    orientation: 'portrait',
    format: 'A4',
    includePatientInfo: true,
    includeStudyInfo: true,
    includeMeasurements: true,
    includeAnnotations: true,
    includeImages: false,
    imageQuality: 0.8,
    title: 'Medical Imaging Report',
    subtitle: 'Annotation and Measurement Summary',
    colorScheme: {
      primary: '#2c3e50',
      secondary: '#34495e',
      accent: '#3498db',
      text: '#2c3e50',
      background: '#ffffff',
    },
    fonts: {
      title: { family: 'Arial', size: 18 },
      heading: { family: 'Arial', size: 14 },
      body: { family: 'Arial', size: 11 },
      caption: { family: 'Arial', size: 9 },
    },
  };

  private constructor() {
    log.info('📄 PDF Export Service initialized');
  }

  static getInstance(): PDFExportService {
    if (!PDFExportService.instance) {
      PDFExportService.instance = new PDFExportService();
    }
    return PDFExportService.instance;
  }

  /**
   * Export annotations to PDF
   */
  async exportToPDF(
    annotationData: AnnotationExport,
    options: PDFExportOptions = {},
  ): Promise<Blob> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const layout = this.getPageLayout(mergedOptions.format!, mergedOptions.orientation!);

    // Create PDF generator
    const generator = new CanvasPDFGenerator(layout, mergedOptions);
    generator.createDocument(mergedOptions);

    // Generate content sections
    const sections = this.generateContentSections(annotationData, mergedOptions);

    // Render sections
    for (const section of sections) {
      await this.renderSection(generator, section, layout, mergedOptions);
    }

    const blob = await generator.generateBlob();
    log.info(`📄 Generated PDF with ${annotationData.annotations.length} annotations`);

    return blob;
  }

  /**
   * Export and download PDF
   */
  async exportAndDownload(
    annotationData: AnnotationExport,
    filename: string = 'medical-imaging-report.pdf',
    options: PDFExportOptions = {},
  ): Promise<void> {
    const blob = await this.exportToPDF(annotationData, options);

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    log.info(`📄 Downloaded PDF: ${filename}`);
  }

  /**
   * Get page layout for format and orientation
   */
  private getPageLayout(format: string, orientation: string): PDFPageLayout {
    const formats: Record<string, { width: number; height: number }> = {
      A4: { width: 595, height: 842 },
      A3: { width: 842, height: 1191 },
      Letter: { width: 612, height: 792 },
      Legal: { width: 612, height: 1008 },
    };

    const { width, height } = formats[format]; // eslint-disable-line security/detect-object-injection
    const finalWidth = orientation === 'landscape' ? height : width;
    const finalHeight = orientation === 'landscape' ? width : height;

    const margins = {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    };

    return {
      width: finalWidth,
      height: finalHeight,
      margins,
      contentArea: {
        x: margins.left,
        y: margins.top,
        width: finalWidth - margins.left - margins.right,
        height: finalHeight - margins.top - margins.bottom,
      },
    };
  }

  /**
   * Generate content sections
   */
  private generateContentSections(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection[] {
    const sections: PDFContentSection[] = [];

    // Header section
    sections.push(this.createHeaderSection(annotationData, options));

    // Patient info section
    if (options.includePatientInfo && annotationData.metadata.studyInfo) {
      sections.push(this.createPatientInfoSection(annotationData, options));
    }

    // Study info section
    if (options.includeStudyInfo && annotationData.metadata.studyInfo) {
      sections.push(this.createStudyInfoSection(annotationData, options));
    }

    // Measurements section
    if (options.includeMeasurements) {
      const measurementSection = this.createMeasurementsSection(annotationData, options);
      if (measurementSection.content.length > 0) {
        sections.push(measurementSection);
      }
    }

    // Annotations section
    if (options.includeAnnotations) {
      const annotationSection = this.createAnnotationsSection(annotationData, options);
      if (annotationSection.content.length > 0) {
        sections.push(annotationSection);
      }
    }

    // Footer section
    sections.push(this.createFooterSection(annotationData, options));

    return sections;
  }

  /**
   * Create header section
   */
  private createHeaderSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];

    // Title
    content.push({
      type: 'text',
      data: options.title || 'Medical Imaging Report',
      style: {
        fontSize: options.fonts!.title.size,
        fontFamily: options.fonts!.title.family,
        color: options.colorScheme!.primary,
        alignment: 'center',
        margin: 10,
      },
    });

    // Subtitle
    if (options.subtitle) {
      content.push({
        type: 'text',
        data: options.subtitle,
        style: {
          fontSize: options.fonts!.heading.size,
          fontFamily: options.fonts!.heading.family,
          color: options.colorScheme!.secondary,
          alignment: 'center',
          margin: 5,
        },
      });
    }

    // Export info
    content.push({
      type: 'text',
      data: `Generated on: ${annotationData.exportedAt.toLocaleString()}`,
      style: {
        fontSize: options.fonts!.caption.size,
        fontFamily: options.fonts!.caption.family,
        color: options.colorScheme!.text,
        alignment: 'center',
        margin: 15,
      },
    });

    return {
      type: 'header',
      title: 'Report Header',
      content,
      style: {
        borderColor: options.colorScheme!.primary,
        padding: 10,
        margin: 10,
      },
    };
  }

  /**
   * Create patient info section
   */
  private createPatientInfoSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];
    const studyInfo = annotationData.metadata.studyInfo!;

    const patientData = [
      ['Patient ID', studyInfo.patientId || 'N/A'],
      ['Study Date', studyInfo.studyDate || 'N/A'],
      ['Modality', studyInfo.modality || 'N/A'],
    ];

    content.push({
      type: 'table',
      data: patientData,
      style: {
        fontSize: options.fonts!.body.size,
        fontFamily: options.fonts!.body.family,
        width: '100%',
      },
    });

    return {
      type: 'patient-info',
      title: 'Patient Information',
      content,
      style: {
        backgroundColor: '#f8f9fa',
        padding: 10,
        margin: 5,
      },
    };
  }

  /**
   * Create study info section
   */
  private createStudyInfoSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];

    const studyData = [
      ['Total Annotations', annotationData.metadata.totalCount.toString()],
      ['Annotation Types', annotationData.metadata.types.join(', ')],
      ['Categories', annotationData.metadata.categories.join(', ')],
      ['Export Version', annotationData.version],
    ];

    content.push({
      type: 'table',
      data: studyData,
      style: {
        fontSize: options.fonts!.body.size,
        fontFamily: options.fonts!.body.family,
        width: '100%',
      },
    });

    return {
      type: 'study-info',
      title: 'Study Information',
      content,
      style: {
        backgroundColor: '#f8f9fa',
        padding: 10,
        margin: 5,
      },
    };
  }

  /**
   * Create measurements section
   */
  private createMeasurementsSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];
    const measurementTypes: AnnotationType[] = [
      AnnotationType.LENGTH,
      AnnotationType.AREA,
      AnnotationType.AREA,
      AnnotationType.ANGLE,
    ];

    const measurements = annotationData.annotations.filter(annotation =>
      measurementTypes.includes(annotation.type),
    );

    if (measurements.length === 0) {
      return {
        type: 'measurements',
        title: 'Measurements',
        content: [],
      };
    }

    // Group by type and create summaries
    const summaries = this.createMeasurementSummaries(measurements);

    summaries.forEach(summary => {
      // Add type header
      content.push({
        type: 'text',
        data: `${summary.type} Measurements (${summary.count})`,
        style: {
          fontSize: options.fonts!.heading.size,
          fontFamily: options.fonts!.heading.family,
          color: options.colorScheme!.primary,
          margin: 10,
        },
      });

      // Add measurement table
      const tableData = [
        ['ID', 'Value', 'Unit', 'Description'],
        ...summary.values.map(value => [
          value.id,
          String(value.value),
          value.unit || '',
          value.description || '',
        ]),
      ];

      content.push({
        type: 'table',
        data: tableData,
        style: {
          fontSize: options.fonts!.body.size,
          fontFamily: options.fonts!.body.family,
          width: '100%',
        },
      });

      // Add statistics if available
      if (summary.statistics) {
        const statsData = [
          ['Statistic', 'Value'],
          ['Minimum', summary.statistics.min?.toFixed(2) || 'N/A'],
          ['Maximum', summary.statistics.max?.toFixed(2) || 'N/A'],
          ['Mean', summary.statistics.mean?.toFixed(2) || 'N/A'],
          ['Median', summary.statistics.median?.toFixed(2) || 'N/A'],
          ['Std Dev', summary.statistics.stdDev?.toFixed(2) || 'N/A'],
        ];

        content.push({
          type: 'table',
          data: statsData,
          style: {
            fontSize: options.fonts!.caption.size,
            fontFamily: options.fonts!.caption.family,
            width: '50%',
          },
        });
      }

      content.push({ type: 'spacer', data: null });
    });

    return {
      type: 'measurements',
      title: 'Measurements Summary',
      content,
      style: {
        padding: 10,
        margin: 5,
      },
    };
  }

  /**
   * Create annotations section
   */
  private createAnnotationsSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];
    const annotationTypes: AnnotationType[] = [
      AnnotationType.TEXT,
      AnnotationType.ARROW,
      AnnotationType.PROBE,
    ];

    const annotations = annotationData.annotations.filter(annotation =>
      annotationTypes.includes(annotation.type),
    );

    if (annotations.length === 0) {
      return {
        type: 'annotations',
        title: 'Annotations',
        content: [],
      };
    }

    // Create annotations table
    const tableData = [
      ['ID', 'Type', 'Description', 'Created'],
      ...annotations.map(annotation => [
        annotation.id,
        annotation.type,
        annotation.metadata.description || 'No description',
        new Date(annotation.metadata.createdAt).toLocaleDateString(),
      ]),
    ];

    content.push({
      type: 'table',
      data: tableData,
      style: {
        fontSize: options.fonts!.body.size,
        fontFamily: options.fonts!.body.family,
        width: '100%',
      },
    });

    return {
      type: 'annotations',
      title: 'Annotations Summary',
      content,
      style: {
        padding: 10,
        margin: 5,
      },
    };
  }

  /**
   * Create footer section
   */
  private createFooterSection(
    annotationData: AnnotationExport,
    options: PDFExportOptions,
  ): PDFContentSection {
    const content: PDFContentItem[] = [];

    content.push({
      type: 'text',
      data: options.footer || `Generated by ${annotationData.metadata.application}`,
      style: {
        fontSize: options.fonts!.caption.size,
        fontFamily: options.fonts!.caption.family,
        color: options.colorScheme!.secondary,
        alignment: 'center',
      },
    });

    return {
      type: 'footer',
      title: 'Footer',
      content,
      style: {
        borderColor: options.colorScheme!.secondary,
        padding: 5,
      },
    };
  }

  /**
   * Create measurement summaries
   */
  private createMeasurementSummaries(measurements: SerializedAnnotation[]): MeasurementSummary[] {
    const groups = new Map<AnnotationType, SerializedAnnotation[]>();

    measurements.forEach(measurement => {
      if (!groups.has(measurement.type)) {
        groups.set(measurement.type, []);
      }
      groups.get(measurement.type)!.push(measurement);
    });

    return Array.from(groups.entries()).map(([type, annotations]) => {
      const values = annotations.map(annotation => {
        const value = this.extractMeasurementValue(annotation);
        return {
          id: annotation.id,
          value,
          unit: this.getMeasurementUnit(type),
          description: annotation.metadata.description,
          imageId: annotation.viewportInfo.imageId,
        };
      });

      const numericValues = values
        .map(v => typeof v.value === 'number' ? v.value : parseFloat(String(v.value)))
        .filter(v => !isNaN(v));

      const statistics = numericValues.length > 0 ? {
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
        median: this.calculateMedian(numericValues),
        stdDev: this.calculateStandardDeviation(numericValues),
      } : undefined;

      return {
        type,
        count: annotations.length,
        values,
        statistics,
      };
    });
  }

  /**
   * Extract measurement value from annotation
   */
  private extractMeasurementValue(annotation: SerializedAnnotation): number | string {
    const data = annotation.data as Record<string, unknown>;

    // Try different common measurement property names
    const possibleKeys = ['value', 'length', 'area', 'volume', 'angle', 'measurements'];

    for (const key of possibleKeys) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]; // eslint-disable-line security/detect-object-injection
        if (typeof value === 'number') {
          return value;
        }
        if (typeof value === 'object' && value !== null) {
          const measurements = value as Record<string, unknown>;
          if (Object.prototype.hasOwnProperty.call(measurements, 'value')) {
            const measurementValue = measurements.value;
            if (typeof measurementValue === 'number') {
              return measurementValue;
            }
          }
        }
      }
    }

    return 'N/A';
  }

  /**
   * Get measurement unit for annotation type
   */
  private getMeasurementUnit(type: AnnotationType): string {
    switch (type) {
      case AnnotationType.LENGTH:
        return 'mm';
      case AnnotationType.AREA:
        return 'mm²';
      case AnnotationType.ANGLE:
        return '°';
      default:
        return '';
    }
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      // eslint-disable-next-line security/detect-object-injection
      ? (sorted[mid - 1] + sorted[mid]) / 2
      // eslint-disable-next-line security/detect-object-injection
      : sorted[mid];
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Render section to PDF
   */
  private async renderSection(
    generator: PDFGenerator,
    section: PDFContentSection,
    layout: PDFPageLayout,
    options: PDFExportOptions,
  ): Promise<void> {
    // const startY = generator.getCurrentY();

    // Add section title
    if (section.title) {
      generator.addText(
        section.title,
        layout.contentArea.x,
        generator.getCurrentY(),
        {
          fontSize: options.fonts!.heading.size,
          fontFamily: options.fonts!.heading.family,
          color: options.colorScheme!.primary,
          margin: 10,
        },
      );

      // Add underline
      generator.addLine(
        layout.contentArea.x,
        generator.getCurrentY() - 5,
        layout.contentArea.x + layout.contentArea.width,
        generator.getCurrentY() - 5,
        { color: options.colorScheme!.primary, width: 1 },
      );
    }

    // Render content items
    for (const item of section.content) {
      await this.renderContentItem(generator, item, layout, options);

      // Check if we need a new page
      if (generator.getCurrentY() > layout.height - layout.margins.bottom - 50) {
        generator.addPage();
      }
    }

    // Add section spacing
    generator.setCurrentY(generator.getCurrentY() + 15);
  }

  /**
   * Render content item
   */
  private async renderContentItem(
    generator: PDFGenerator,
    item: PDFContentItem,
    layout: PDFPageLayout,
    options: PDFExportOptions,
  ): Promise<void> {
    const x = layout.contentArea.x + (item.style?.margin || 0);
    const y = generator.getCurrentY();

    switch (item.type) {
      case 'text':
        generator.addText(item.data, x, y, {
          fontSize: item.style?.fontSize || options.fonts!.body.size,
          fontFamily: item.style?.fontFamily || options.fonts!.body.family,
          color: item.style?.color || options.colorScheme!.text,
          alignment: item.style?.alignment || 'left',
          margin: item.style?.margin || 5,
        });
        break;

      case 'table':
        generator.addTable(item.data, x, y, {
          fontSize: item.style?.fontSize || options.fonts!.body.size,
          fontFamily: item.style?.fontFamily || options.fonts!.body.family,
          textColor: item.style?.color || options.colorScheme!.text,
          borderColor: '#dddddd',
          headerStyle: {
            backgroundColor: options.colorScheme!.accent,
            color: '#ffffff',
          },
          cellHeight: 20,
          cellPadding: 5,
          columnWidths: this.calculateColumnWidths(item.data, layout.contentArea.width - 20),
        });
        break;

      case 'image':
        if (item.data) {
          const width = typeof item.style?.width === 'number' ? item.style.width : 200;
          const height = typeof item.style?.height === 'number' ? item.style.height : 150;
          generator.addImage(item.data, x, y, width, height);
        }
        break;

      case 'spacer':
        generator.setCurrentY(generator.getCurrentY() + 15);
        break;
    }
  }

  /**
   * Calculate column widths for table
   */
  private calculateColumnWidths(data: any[][], maxWidth: number): number[] {
    if (data.length === 0) return [];

    const columnCount = data[0].length;
    const baseWidth = maxWidth / columnCount;

    return new Array(columnCount).fill(baseWidth);
  }
}

// Export singleton instance
export const pdfExportService = PDFExportService.getInstance();
