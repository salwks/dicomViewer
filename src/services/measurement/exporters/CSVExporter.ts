/**
 * CSV Export Manager
 * Handles export of measurements to CSV format
 */

import {
  MeasurementResult,
  measurementLogger,
  SafePropertyAccess,
} from '../interfaces/MeasurementTypes';

/**
 * CSV export options
 */
export interface CSVExportOptions {
  /** Field separator */
  separator?: string;
  /** Include header row */
  includeHeader?: boolean;
  /** Include statistical columns */
  includeStatistics?: boolean;
  /** Include calibration columns */
  includeCalibration?: boolean;
  /** Include alternative units */
  includeAlternativeUnits?: boolean;
  /** Date format for timestamps */
  dateFormat?: 'iso' | 'local' | 'short';
  /** Decimal precision for numbers */
  decimalPrecision?: number;
  /** Custom column mapping */
  customColumns?: Array<{
    header: string;
    accessor: (measurement: any) => string | number;
  }>;
}

/**
 * CSV export result
 */
export interface CSVExportResult {
  /** Success status */
  success: boolean;
  /** Exported CSV string */
  data?: string;
  /** Error message if failed */
  error?: string;
  /** Export metadata */
  metadata: {
    exportedAt: string;
    measurementCount: number;
    columnCount: number;
    format: string;
    version: string;
  };
}

/**
 * CSV column definition
 */
export interface CSVColumn {
  /** Column header */
  header: string;
  /** Data accessor function */
  accessor: (measurement: any) => string | number;
  /** Data type for formatting */
  type?: 'string' | 'number' | 'date' | 'boolean';
}

/**
 * CSV Export Manager
 */
export class CSVExporter {
  private static instance: CSVExporter;

  private constructor() {
    measurementLogger.info('CSV Exporter initialized', 'CSVExporter');
  }

  static getInstance(): CSVExporter {
    if (!CSVExporter.instance) {
      CSVExporter.instance = new CSVExporter();
    }
    return CSVExporter.instance;
  }

  /**
   * Export measurements to CSV
   */
  exportMeasurements(
    measurements: Array<{ id: string; type: string; result?: MeasurementResult }>,
    options: CSVExportOptions = {},
  ): CSVExportResult {
    try {
      const csvContent = this.generateCSVContent(measurements, options);
      const columnCount = this.calculateColumnCount(options);

      const result: CSVExportResult = {
        success: true,
        data: csvContent,
        metadata: {
          exportedAt: new Date().toISOString(),
          measurementCount: measurements.filter(m => m.result).length,
          columnCount,
          format: 'text/csv',
          version: '1.0.0',
        },
      };

      measurementLogger.info(`Exported ${measurements.length} measurements to CSV`, 'CSVExporter', {
        measurementCount: measurements.length,
        dataSize: csvContent.length,
        columnCount,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during CSV export';

      measurementLogger.error('Failed to export measurements to CSV', 'CSVExporter', {
        error: errorMessage,
        measurementCount: measurements.length,
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          exportedAt: new Date().toISOString(),
          measurementCount: measurements.length,
          columnCount: 0,
          format: 'text/csv',
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Export single measurement to CSV
   */
  exportSingleMeasurement(
    id: string,
    type: string,
    result: MeasurementResult,
    options: CSVExportOptions = {},
  ): CSVExportResult {
    return this.exportMeasurements([{ id, type, result }], options);
  }

  /**
   * Generate CSV content
   */
  private generateCSVContent(
    measurements: Array<{ id: string; type: string; result?: MeasurementResult }>,
    options: CSVExportOptions,
  ): string {
    const separator = options.separator || ',';
    const includeHeader = options.includeHeader !== false; // Default to true
    const columns = this.defineColumns(options);

    const lines: string[] = [];

    // Add header row if requested
    if (includeHeader) {
      const headerRow = columns.map(col => this.escapeCSVField(col.header)).join(separator);
      lines.push(headerRow);
    }

    // Add data rows
    measurements.forEach(measurement => {
      if (!measurement.result) {
        return; // Skip measurements without results
      }

      const row = columns.map(col => {
        try {
          const value = col.accessor(measurement);
          return this.formatCSVValue(value, col.type, options);
        } catch (error) {
          measurementLogger.warn(`Error accessing column ${col.header} for measurement ${measurement.id}`, 'CSVExporter', {
            measurementId: measurement.id,
            column: col.header,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          return '';
        }
      }).join(separator);

      lines.push(row);
    });

    return lines.join('\n');
  }

  /**
   * Define CSV columns based on options
   */
  private defineColumns(options: CSVExportOptions): CSVColumn[] {
    const columns: CSVColumn[] = [];

    // Basic columns
    columns.push(
      { header: 'ID', accessor: (m) => m.id, type: 'string' },
      { header: 'Type', accessor: (m) => m.type, type: 'string' },
      { header: 'Value', accessor: (m) => m.result?.value || 0, type: 'number' },
      { header: 'Unit', accessor: (m) => m.result?.unit || '', type: 'string' },
      { header: 'Confidence', accessor: (m) => m.result?.confidence || 0, type: 'number' },
      { header: 'Method', accessor: (m) => m.result?.metadata.method || '', type: 'string' },
      { header: 'Timestamp', accessor: (m) => m.result?.metadata.timestamp || new Date(), type: 'date' },
    );

    // Image context columns
    columns.push(
      { header: 'Image ID', accessor: (m) => m.result?.metadata.imageContext?.imageId || '', type: 'string' },
      { header: 'Series UID', accessor: (m) => m.result?.metadata.imageContext?.seriesInstanceUID || '', type: 'string' },
      { header: 'Study UID', accessor: (m) => m.result?.metadata.imageContext?.studyInstanceUID || '', type: 'string' },
      { header: 'Modality', accessor: (m) => m.result?.metadata.imageContext?.modality || '', type: 'string' },
    );

    // Calibration columns
    if (options.includeCalibration) {
      columns.push(
        { header: 'Column Spacing', accessor: (m) => m.result?.metadata.calibration?.pixelSpacing.columnSpacing || 0, type: 'number' },
        { header: 'Row Spacing', accessor: (m) => m.result?.metadata.calibration?.pixelSpacing.rowSpacing || 0, type: 'number' },
        { header: 'Slice Thickness', accessor: (m) => m.result?.metadata.calibration?.pixelSpacing.sliceThickness || 0, type: 'number' },
        { header: 'Calibration Accuracy', accessor: (m) => m.result?.metadata.calibration?.accuracy || 0, type: 'number' },
        { header: 'Calibration Source', accessor: (m) => m.result?.metadata.calibration?.calibrationSource || '', type: 'string' },
      );
    }

    // Statistical columns
    if (options.includeStatistics) {
      columns.push(
        { header: 'Mean', accessor: (m) => m.result?.statistics?.mean || 0, type: 'number' },
        { header: 'Median', accessor: (m) => m.result?.statistics?.median || 0, type: 'number' },
        { header: 'Std Dev', accessor: (m) => m.result?.statistics?.standardDeviation || 0, type: 'number' },
        { header: 'Minimum', accessor: (m) => m.result?.statistics?.minimum || 0, type: 'number' },
        { header: 'Maximum', accessor: (m) => m.result?.statistics?.maximum || 0, type: 'number' },
        { header: 'Count', accessor: (m) => m.result?.statistics?.count || 0, type: 'number' },
        { header: 'P25', accessor: (m) => m.result?.statistics?.percentile25 || 0, type: 'number' },
        { header: 'P75', accessor: (m) => m.result?.statistics?.percentile75 || 0, type: 'number' },
        { header: 'Skewness', accessor: (m) => m.result?.statistics?.skewness || 0, type: 'number' },
        { header: 'Kurtosis', accessor: (m) => m.result?.statistics?.kurtosis || 0, type: 'number' },
      );
    }

    // Alternative units columns
    if (options.includeAlternativeUnits) {
      columns.push(
        { header: 'Alt Unit 1', accessor: (m) => m.result?.alternativeUnits?.[0]?.unit || '', type: 'string' },
        { header: 'Alt Value 1', accessor: (m) => m.result?.alternativeUnits?.[0]?.value || 0, type: 'number' },
        { header: 'Alt Unit 2', accessor: (m) => m.result?.alternativeUnits?.[1]?.unit || '', type: 'string' },
        { header: 'Alt Value 2', accessor: (m) => m.result?.alternativeUnits?.[1]?.value || 0, type: 'number' },
      );
    }

    // Custom columns
    if (options.customColumns) {
      options.customColumns.forEach(customCol => {
        columns.push({
          header: customCol.header,
          accessor: customCol.accessor,
          type: 'string', // Default to string for custom columns
        });
      });
    }

    return columns;
  }

  /**
   * Format CSV value based on type
   */
  private formatCSVValue(
    value: string | number | Date,
    type: CSVColumn['type'] = 'string',
    options: CSVExportOptions,
  ): string {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case 'number':
        if (typeof value === 'number') {
          const precision = options.decimalPrecision !== undefined ? options.decimalPrecision : 3;
          return this.escapeCSVField(value.toFixed(precision));
        }
        return this.escapeCSVField(String(value));

      case 'date':
        if (value instanceof Date) {
          const format = options.dateFormat || 'iso';
          switch (format) {
            case 'iso':
              return this.escapeCSVField(value.toISOString());
            case 'local':
              return this.escapeCSVField(value.toLocaleString());
            case 'short':
              return this.escapeCSVField(value.toLocaleDateString());
            default:
              return this.escapeCSVField(value.toISOString());
          }
        }
        return this.escapeCSVField(String(value));

      case 'boolean':
        return this.escapeCSVField(value ? 'true' : 'false');

      case 'string':
      default:
        return this.escapeCSVField(String(value));
    }
  }

  /**
   * Escape CSV field if it contains special characters
   */
  private escapeCSVField(value: string): string {
    const stringValue = String(value);

    // Check if field contains comma, quote, or newline
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      // Escape quotes by doubling them and wrap in quotes
      const escapedValue = stringValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }

    return stringValue;
  }

  /**
   * Calculate number of columns based on options
   */
  private calculateColumnCount(options: CSVExportOptions): number {
    let count = 7; // Basic columns: ID, Type, Value, Unit, Confidence, Method, Timestamp
    count += 4; // Image context: Image ID, Series UID, Study UID, Modality

    if (options.includeCalibration) {
      count += 5; // Calibration columns
    }

    if (options.includeStatistics) {
      count += 10; // Statistical columns
    }

    if (options.includeAlternativeUnits) {
      count += 4; // Alternative units columns
    }

    if (options.customColumns) {
      count += options.customColumns.length;
    }

    return count;
  }

  /**
   * Parse CSV string into measurement data
   */
  parseCSV(
    csvString: string,
    options: CSVExportOptions = {},
  ): {
    success: boolean;
    data?: Array<Record<string, string>>;
    error?: string;
    metadata?: {
      rowCount: number;
      columnCount: number;
    };
  } {
    try {
      const separator = options.separator || ',';
      const includeHeader = options.includeHeader !== false;

      const lines = csvString.trim().split('\n');
      if (lines.length === 0) {
        return {
          success: false,
          error: 'Empty CSV data',
        };
      }

      let headers: string[] = [];
      let dataStartIndex = 0;

      if (includeHeader) {
        headers = this.parseCSVLine(lines[0], separator);
        dataStartIndex = 1;
      } else {
        // Generate generic headers if no header row
        const firstLine = this.parseCSVLine(lines[0], separator);
        headers = firstLine.map((_, index) => `Column${index + 1}`);
      }

      const data: Array<Record<string, string>> = [];

      for (let i = dataStartIndex; i < lines.length; i++) {
        // eslint-disable-next-line security/detect-object-injection
        const values = this.parseCSVLine(lines[i], separator);
        if (values.length === 0) continue; // Skip empty lines

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          // eslint-disable-next-line security/detect-object-injection
          row[header] = SafePropertyAccess.safeArrayAccess(values, index) || '';
        });
        data.push(row);
      }

      measurementLogger.info(`Parsed CSV with ${data.length} rows and ${headers.length} columns`, 'CSVExporter', {
        rowCount: data.length,
        columnCount: headers.length,
      });

      return {
        success: true,
        data,
        metadata: {
          rowCount: data.length,
          columnCount: headers.length,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during CSV parsing';

      measurementLogger.error('Failed to parse CSV data', 'CSVExporter', {
        error: errorMessage,
      }, error instanceof Error ? error : undefined);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  private parseCSVLine(line: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      // eslint-disable-next-line security/detect-object-injection
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
          continue;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        // Field separator outside quotes
        result.push(current);
        current = '';
      } else {
        // Regular character
        current += char;
      }

      i++;
    }

    // Add the last field
    result.push(current);

    return result;
  }

  /**
   * Generate CSV template with headers only
   */
  generateTemplate(options: CSVExportOptions = {}): string {
    const columns = this.defineColumns(options);
    const separator = options.separator || ',';

    return columns.map(col => this.escapeCSVField(col.header)).join(separator);
  }
}

// Export singleton instance
export const csvExporter = CSVExporter.getInstance();
