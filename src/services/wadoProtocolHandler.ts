/* eslint-disable security/detect-object-injection */
// NOTE: WADO protocol handling requires dynamic property access for request parameters
/**
 * WADO Protocol Handler
 *
 * Implementation of WADO-URI and WADO-RS protocols for DICOM data retrieval
 * Based on Context7 documentation patterns from /cornerstonejs/cornerstone3d
 * Reference: 443 code examples for DICOM protocol handling
 *
 * Standards implemented:
 * - DICOM PS3.18 (Web Services)
 * - WADO-URI (Web Access to DICOM Objects)
 * - WADO-RS (Web Access to DICOM Objects RESTful Services)
 */

import { MedicalImagingError, ErrorCategory } from '../types';

/**
 * WADO-URI protocol configuration
 * Following DICOM PS3.18 specification
 */
export interface WADOURIConfig {
  endpoint: string;
  requestType: 'WADO';
  contentType?: 'application/dicom' | 'image/jpeg' | 'image/png' | 'image/gif';
  charset?: string;
  anonymize?: 'yes' | 'no';
  annotation?: 'patient' | 'technique';
  rows?: number;
  columns?: number;
  region?: string;
  windowCenter?: number;
  windowWidth?: number;
  frameNumber?: number;
  imageQuality?: number; // 1-100
  presentationUID?: string;
  presentationSeriesUID?: string;
  transferSyntax?: string;
  // Authentication
  apiKey?: string;
  authToken?: string;
  customHeaders?: Record<string, string>;
}

/**
 * WADO-RS protocol configuration
 * Following DICOM PS3.18 RESTful specification
 */
export interface WADORSConfig {
  endpoint: string;
  accept?: 'application/dicom' | 'multipart/related' | 'application/octet-stream';
  acceptCharset?: string;
  // Query parameters
  includefield?: string[];
  limit?: number;
  offset?: number;
  fuzzymatching?: boolean;
  // Rendering parameters
  viewport?: string;
  quality?: number;
  // Authentication
  apiKey?: string;
  authToken?: string;
  customHeaders?: Record<string, string>;
}

/**
 * DICOM identifiers for WADO requests
 */
export interface DICOMIdentifiers {
  studyInstanceUID: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
}

/**
 * WADO request options
 */
export interface WADORequestOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  signal?: AbortSignal;
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * WADO response metadata
 */
export interface WADOResponse {
  data: ArrayBuffer | Blob;
  contentType: string;
  contentLength?: number;
  transferSyntax?: string;
  studyInstanceUID?: string;
  seriesInstanceUID?: string;
  sopInstanceUID?: string;
  metadata?: Record<string, any>;
}

/**
 * WADO Protocol Handler Class
 * Implements both WADO-URI and WADO-RS protocols
 */
export class WADOProtocolHandler {
  private wadoURIConfig?: WADOURIConfig;
  private wadoRSConfig?: WADORSConfig;
  private requestCount = 0;
  private errorCount = 0;

  constructor(config?: { wadoURI?: WADOURIConfig; wadoRS?: WADORSConfig }) {
    this.wadoURIConfig = config?.wadoURI;
    this.wadoRSConfig = config?.wadoRS;
  }

  /**
   * Configure WADO-URI endpoint
   * Following Context7 WADO-URI configuration patterns
   */
  configureWADOURI(config: WADOURIConfig): void {
    this.wadoURIConfig = config;
    console.log(`🌐 WADO-URI configured: ${config.endpoint}`);
  }

  /**
   * Configure WADO-RS endpoint
   * Following Context7 WADO-RS configuration patterns
   */
  configureWADORS(config: WADORSConfig): void {
    this.wadoRSConfig = config;
    console.log(`🌐 WADO-RS configured: ${config.endpoint}`);
  }

  /**
   * Retrieve DICOM instance using WADO-URI protocol
   * Based on Context7 WADO-URI retrieval patterns
   */
  async retrieveInstanceWADOURI(
    identifiers: DICOMIdentifiers,
    options?: WADORequestOptions & Partial<WADOURIConfig>,
  ): Promise<WADOResponse> {
    if (!this.wadoURIConfig) {
      throw new Error('WADO-URI not configured');
    }

    // Build WADO-URI request URL
    const url = this.buildWADOURIUrl(identifiers, options);
    const requestOptions = this.buildWADOURIRequestOptions(options);

    try {
      this.requestCount++;
      console.log(`🔄 WADO-URI request: ${url}`);

      const response = await this.performRequest(url, requestOptions, options);

      const wadoResponse: WADOResponse = {
        data: await response.arrayBuffer(),
        contentType: response.headers.get('Content-Type') || 'application/dicom',
        contentLength: parseInt(response.headers.get('Content-Length') || '0'),
        transferSyntax: response.headers.get('Transfer-Syntax') || undefined,
        ...identifiers,
      };

      console.log(`✅ WADO-URI success: ${identifiers.sopInstanceUID} (${wadoResponse.contentLength} bytes)`);
      return wadoResponse;

    } catch (error) {
      this.handleWADOError('WADO-URI', error as Error, identifiers);
      throw error;
    }
  }

  /**
   * Retrieve DICOM instance using WADO-RS protocol
   * Based on Context7 WADO-RS retrieval patterns
   */
  async retrieveInstanceWADORS(
    identifiers: DICOMIdentifiers,
    options?: WADORequestOptions & Partial<WADORSConfig>,
  ): Promise<WADOResponse> {
    if (!this.wadoRSConfig) {
      throw new Error('WADO-RS not configured');
    }

    // Build WADO-RS request URL
    const url = this.buildWADORSUrl(identifiers, options);
    const requestOptions = this.buildWADORSRequestOptions(options);

    try {
      this.requestCount++;
      console.log(`🔄 WADO-RS request: ${url}`);

      const response = await this.performRequest(url, requestOptions, options);

      // Handle multipart response for WADO-RS
      const contentType = response.headers.get('Content-Type') || '';
      let data: ArrayBuffer;

      if (contentType.includes('multipart/related')) {
        data = await this.parseMultipartResponse(response);
      } else {
        data = await response.arrayBuffer();
      }

      const wadoResponse: WADOResponse = {
        data,
        contentType,
        contentLength: data.byteLength,
        ...identifiers,
      };

      console.log(`✅ WADO-RS success: ${identifiers.sopInstanceUID} (${wadoResponse.contentLength} bytes)`);
      return wadoResponse;

    } catch (error) {
      this.handleWADOError('WADO-RS', error as Error, identifiers);
      throw error;
    }
  }

  /**
   * Query DICOM metadata using WADO-RS QIDO-RS
   * Following Context7 QIDO-RS query patterns
   */
  async queryStudies(
    queryParams?: Record<string, string>,
    options?: WADORequestOptions & Partial<WADORSConfig>,
  ): Promise<any[]> {
    if (!this.wadoRSConfig) {
      throw new Error('WADO-RS not configured for queries');
    }

    const url = this.buildQIDORSUrl('studies', queryParams);
    const requestOptions = this.buildWADORSRequestOptions(options);

    try {
      console.log(`🔍 QIDO-RS query: ${url}`);
      const response = await this.performRequest(url, requestOptions, options);

      const results = await response.json();
      console.log(`✅ QIDO-RS results: ${results.length} studies found`);

      return results;

    } catch (error) {
      this.handleWADOError('QIDO-RS', error as Error);
      throw error;
    }
  }

  /**
   * Query DICOM series using WADO-RS QIDO-RS
   */
  async querySeries(
    studyInstanceUID: string,
    queryParams?: Record<string, string>,
    options?: WADORequestOptions & Partial<WADORSConfig>,
  ): Promise<any[]> {
    if (!this.wadoRSConfig) {
      throw new Error('WADO-RS not configured for queries');
    }

    const url = this.buildQIDORSUrl(`studies/${studyInstanceUID}/series`, queryParams);
    const requestOptions = this.buildWADORSRequestOptions(options);

    try {
      console.log(`🔍 QIDO-RS series query: ${url}`);
      const response = await this.performRequest(url, requestOptions, options);

      const results = await response.json();
      console.log(`✅ QIDO-RS series results: ${results.length} series found`);

      return results;

    } catch (error) {
      this.handleWADOError('QIDO-RS', error as Error);
      throw error;
    }
  }

  /**
   * Query DICOM instances using WADO-RS QIDO-RS
   */
  async queryInstances(
    studyInstanceUID: string,
    seriesInstanceUID?: string,
    queryParams?: Record<string, string>,
    options?: WADORequestOptions & Partial<WADORSConfig>,
  ): Promise<any[]> {
    if (!this.wadoRSConfig) {
      throw new Error('WADO-RS not configured for queries');
    }

    let path = `studies/${studyInstanceUID}`;
    if (seriesInstanceUID) {
      path += `/series/${seriesInstanceUID}`;
    }
    path += '/instances';

    const url = this.buildQIDORSUrl(path, queryParams);
    const requestOptions = this.buildWADORSRequestOptions(options);

    try {
      console.log(`🔍 QIDO-RS instances query: ${url}`);
      const response = await this.performRequest(url, requestOptions, options);

      const results = await response.json();
      console.log(`✅ QIDO-RS instances results: ${results.length} instances found`);

      return results;

    } catch (error) {
      this.handleWADOError('QIDO-RS', error as Error);
      throw error;
    }
  }

  /**
   * Get protocol handler statistics
   */
  getStatistics() {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      wadoURIConfigured: !!this.wadoURIConfig,
      wadoRSConfigured: !!this.wadoRSConfig,
      wadoURIEndpoint: this.wadoURIConfig?.endpoint,
      wadoRSEndpoint: this.wadoRSConfig?.endpoint,
      averageLoadTime: this.requestCount > 0 ? 1000 : 0, // placeholder
      cacheHitRate: 0, // placeholder
    };
  }

  /**
   * Reset statistics and configuration
   */
  reset(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    console.log('🔄 WADO Protocol Handler reset');
  }

  /**
   * Build WADO-URI request URL
   * Following DICOM PS3.18 WADO-URI specification
   */
  private buildWADOURIUrl(
    identifiers: DICOMIdentifiers,
    options?: Partial<WADOURIConfig>,
  ): string {
    const config = { ...this.wadoURIConfig, ...options };
    const url = new URL(config.endpoint!);

    // Required parameters
    url.searchParams.set('requestType', 'WADO');
    url.searchParams.set('studyUID', identifiers.studyInstanceUID);

    if (identifiers.seriesInstanceUID) {
      url.searchParams.set('seriesUID', identifiers.seriesInstanceUID);
    }

    if (identifiers.sopInstanceUID) {
      url.searchParams.set('objectUID', identifiers.sopInstanceUID);
    }

    // Optional parameters
    if (config.contentType) {
      url.searchParams.set('contentType', config.contentType);
    }

    if (config.charset) {
      url.searchParams.set('charset', config.charset);
    }

    if (config.anonymize) {
      url.searchParams.set('anonymize', config.anonymize);
    }

    if (config.annotation) {
      url.searchParams.set('annotation', config.annotation);
    }

    if (config.rows) {
      url.searchParams.set('rows', config.rows.toString());
    }

    if (config.columns) {
      url.searchParams.set('columns', config.columns.toString());
    }

    if (config.region) {
      url.searchParams.set('region', config.region);
    }

    if (config.windowCenter !== undefined) {
      url.searchParams.set('windowCenter', config.windowCenter.toString());
    }

    if (config.windowWidth !== undefined) {
      url.searchParams.set('windowWidth', config.windowWidth.toString());
    }

    if (config.frameNumber) {
      url.searchParams.set('frameNumber', config.frameNumber.toString());
    }

    if (config.imageQuality) {
      url.searchParams.set('imageQuality', config.imageQuality.toString());
    }

    if (config.presentationUID) {
      url.searchParams.set('presentationUID', config.presentationUID);
    }

    if (config.transferSyntax) {
      url.searchParams.set('transferSyntax', config.transferSyntax);
    }

    return url.toString();
  }

  /**
   * Build WADO-RS request URL
   * Following DICOM PS3.18 WADO-RS specification
   */
  private buildWADORSUrl(
    identifiers: DICOMIdentifiers,
    options?: Partial<WADORSConfig>,
  ): string {
    const config = { ...this.wadoRSConfig, ...options };
    let url = config.endpoint!;

    // Remove trailing slash
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    // Build RESTful path
    url += `/studies/${identifiers.studyInstanceUID}`;

    if (identifiers.seriesInstanceUID) {
      url += `/series/${identifiers.seriesInstanceUID}`;
    }

    if (identifiers.sopInstanceUID) {
      url += `/instances/${identifiers.sopInstanceUID}`;
    }

    // Add query parameters if any
    const urlObj = new URL(url);

    if (config.includefield && config.includefield.length > 0) {
      config.includefield.forEach(field => {
        urlObj.searchParams.append('includefield', field);
      });
    }

    if (config.limit) {
      urlObj.searchParams.set('limit', config.limit.toString());
    }

    if (config.offset) {
      urlObj.searchParams.set('offset', config.offset.toString());
    }

    if (config.fuzzymatching !== undefined) {
      urlObj.searchParams.set('fuzzymatching', config.fuzzymatching.toString());
    }

    return urlObj.toString();
  }

  /**
   * Build QIDO-RS query URL
   */
  private buildQIDORSUrl(path: string, queryParams?: Record<string, string>): string {
    let url = this.wadoRSConfig!.endpoint;

    // Remove trailing slash
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    url += `/${path}`;

    if (queryParams) {
      const urlObj = new URL(url);
      Object.entries(queryParams).forEach(([key, value]) => {
        urlObj.searchParams.set(key, value);
      });
      url = urlObj.toString();
    }

    return url;
  }

  /**
   * Build WADO-URI request options
   */
  private buildWADOURIRequestOptions(options?: Partial<WADOURIConfig>): RequestInit {
    const config = { ...this.wadoURIConfig, ...options };
    const headers = new Map<string, string>();
    headers.set('Accept', config.contentType || 'application/dicom');
    headers.set('User-Agent', 'Cornerstone3D-WADO-Client/1.0');

    // Add authentication headers
    if (config.apiKey) {
      headers.set('X-API-Key', config.apiKey);
    }

    if (config.authToken) {
      headers.set('Authorization', `Bearer ${config.authToken}`);
    }

    // Add custom headers
    if (config.customHeaders) {
      Object.entries(config.customHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    // Convert Map to object for fetch API
    const headersObject: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersObject[key] = value;
    });

    return {
      method: 'GET',
      headers: headersObject,
      mode: 'cors',
      credentials: 'omit',
    };
  }

  /**
   * Build WADO-RS request options
   */
  private buildWADORSRequestOptions(options?: Partial<WADORSConfig>): RequestInit {
    const config = { ...this.wadoRSConfig, ...options };
    const headers = new Map<string, string>();
    headers.set('Accept', config.accept || 'application/dicom');
    headers.set('User-Agent', 'Cornerstone3D-WADO-RS-Client/1.0');

    if (config.acceptCharset) {
      headers.set('Accept-Charset', config.acceptCharset);
    }

    // Add authentication headers
    if (config.apiKey) {
      headers.set('X-API-Key', config.apiKey);
    }

    if (config.authToken) {
      headers.set('Authorization', `Bearer ${config.authToken}`);
    }

    // Add custom headers
    if (config.customHeaders) {
      Object.entries(config.customHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    // Convert Map to object for fetch API
    const headersObject: Record<string, string> = {};
    headers.forEach((value, key) => {
      headersObject[key] = value;
    });

    return {
      method: 'GET',
      headers: headersObject,
      mode: 'cors',
      credentials: 'omit',
    };
  }

  /**
   * Perform HTTP request with retry logic and progress tracking
   */
  private async performRequest(
    url: string,
    options: RequestInit,
    wadoOptions?: WADORequestOptions,
  ): Promise<Response> {
    const timeout = wadoOptions?.timeout || 30000;
    const retryAttempts = wadoOptions?.retryAttempts || 3;
    const retryDelay = wadoOptions?.retryDelay || 1000;

    let lastError: Error;

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine abort signals
        let signal = controller.signal;
        if (wadoOptions?.signal) {
          const combinedController = new AbortController();
          const cleanup = () => {
            controller.abort();
            clearTimeout(timeoutId);
          };

          wadoOptions.signal.addEventListener('abort', cleanup);
          signal.addEventListener('abort', cleanup);
          signal = combinedController.signal;
        }

        const response = await fetch(url, { ...options, signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Track progress if callback provided
        if (wadoOptions?.onProgress && response.body) {
          const contentLength = parseInt(response.headers.get('Content-Length') || '0');
          return this.trackProgress(response, contentLength, wadoOptions.onProgress);
        }

        return response;

      } catch (error) {
        lastError = error as Error;

        if (attempt < retryAttempts - 1) {
          console.warn(`⚠️ WADO request attempt ${attempt + 1} failed, retrying in ${retryDelay}ms...`);
          await this.delay(retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Track download progress
   */
  private async trackProgress(
    response: Response,
    contentLength: number,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<Response> {
    if (!response.body) {
      return response;
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        loaded += value.length;

        onProgress(loaded, contentLength || loaded);
      }

      // Create new response with tracked data
      const blob = new Blob(chunks);
      return new Response(blob, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse multipart/related response for WADO-RS
   */
  private async parseMultipartResponse(response: Response): Promise<ArrayBuffer> {
    const contentType = response.headers.get('Content-Type') || '';
    const boundaryMatch = contentType.match(/boundary=([^;]+)/);

    if (!boundaryMatch) {
      throw new Error('No boundary found in multipart response');
    }

    const boundary = boundaryMatch[1].replace(/"/g, '');
    const text = await response.text();
    const parts = text.split(`--${boundary}`);

    // Find the DICOM part (typically the first non-empty part)
    for (const part of parts) {
      if (part.includes('Content-Type: application/dicom')) {
        // Extract binary data after headers
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const binaryData = part.substring(headerEnd + 4);
          return new TextEncoder().encode(binaryData).buffer as ArrayBuffer;
        }
      }
    }

    throw new Error('No DICOM data found in multipart response');
  }

  /**
   * Handle WADO protocol errors with medical-grade logging
   */
  private handleWADOError(protocol: string, error: Error, identifiers?: DICOMIdentifiers): void {
    this.errorCount++;

    const medicalError: MedicalImagingError = {
      name: `${protocol}_ERROR`,
      message: `${protocol} request failed: ${error.message}`,
      code: 'WADO_REQUEST_FAILED',
      category: ErrorCategory.NETWORK,
      severity: 'HIGH',
      context: identifiers ? {
        studyInstanceUID: identifiers.studyInstanceUID,
        seriesInstanceUID: identifiers.seriesInstanceUID,
        sopInstanceUID: identifiers.sopInstanceUID,
      } : undefined,
    };

    console.error(`❌ ${protocol} error:`, medicalError);

    // In production, report to error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // this.reportMedicalError(medicalError);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create WADO image ID for Cornerstone3D
 * Following Context7 imageId creation patterns
 */
export function createWADOImageId(
  protocol: 'wado-uri' | 'wado-rs',
  identifiers: DICOMIdentifiers,
  endpoint: string,
  options?: Record<string, any>,
): string {
  const params = new URLSearchParams();

  // Add identifiers
  params.set('studyUID', identifiers.studyInstanceUID);
  if (identifiers.seriesInstanceUID) {
    params.set('seriesUID', identifiers.seriesInstanceUID);
  }
  if (identifiers.sopInstanceUID) {
    params.set('objectUID', identifiers.sopInstanceUID);
  }

  // Add endpoint
  params.set('endpoint', endpoint);

  // Add additional options
  if (options) {
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, value.toString());
      }
    });
  }

  return `${protocol}:${params.toString()}`;
}

/**
 * Parse WADO image ID
 * Following Context7 imageId parsing patterns
 */
export function parseWADOImageId(imageId: string): {
  protocol: 'wado-uri' | 'wado-rs';
  identifiers: DICOMIdentifiers;
  endpoint: string;
  options: Record<string, string>;
} {
  const [protocol, paramsString] = imageId.split(':');

  if (protocol !== 'wado-uri' && protocol !== 'wado-rs') {
    throw new Error(`Invalid WADO protocol: ${protocol}`);
  }

  const params = new URLSearchParams(paramsString);

  const identifiers: DICOMIdentifiers = {
    studyInstanceUID: params.get('studyUID') || '',
    seriesInstanceUID: params.get('seriesUID') || undefined,
    sopInstanceUID: params.get('objectUID') || undefined,
  };

  const endpoint = params.get('endpoint') || '';

  // Extract additional options
  const options: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!['studyUID', 'seriesUID', 'objectUID', 'endpoint'].includes(key)) {
      options[key] = value;
    }
  });

  return {
    protocol: protocol as 'wado-uri' | 'wado-rs',
    identifiers,
    endpoint,
    options,
  };
}

// Export singleton instance for application-wide use
export const wadoProtocolHandler = new WADOProtocolHandler();
