/**
 * WADO Protocol Handler
 * Implements WADO-URI and WADO-RS protocol support for DICOM image retrieval
 */

import { log } from '../../utils/logger';
import type { DICOMLoaderConfig, LoadOptions, DICOMMetadata, LoadProgress } from '../AdvancedDICOMLoader';

// ===== WADO Protocol Interfaces =====

export interface WADORequest {
  url: string;
  headers?: Record<string, string>;
  method: 'GET' | 'POST';
  timeout?: number;
  retryAttempts?: number;
  priority?: number;
}

export interface WADOResponse {
  data: ArrayBuffer;
  headers: Record<string, string>;
  status: number;
  contentType: string;
}

export interface WADOAuthConfig {
  type: 'basic' | 'bearer' | 'custom';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
  };
  headerProvider?: () => Promise<Record<string, string>>;
}

export interface WADORetryConfig {
  maxAttempts: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  backoffFactor: number;
  retryCondition?: (response: Response) => boolean;
}

export const DEFAULT_WADO_RETRY_CONFIG: WADORetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (response: Response) => response.status >= 500 || response.status === 429,
};

// ===== WADO-URI Handler =====

export class WADOURIHandler {
  private config: DICOMLoaderConfig;
  private authConfig?: WADOAuthConfig;
  private retryConfig: WADORetryConfig;
  private activeRequests = new Map<string, AbortController>();

  constructor(
    config: DICOMLoaderConfig,
    authConfig?: WADOAuthConfig,
    retryConfig: Partial<WADORetryConfig> = {},
  ) {
    this.config = config;
    this.authConfig = authConfig;
    this.retryConfig = { ...DEFAULT_WADO_RETRY_CONFIG, ...retryConfig };
  }

  public buildWADOURIUrl(
    studyUID: string,
    seriesUID: string,
    objectUID: string,
    options: {
      rows?: number;
      columns?: number;
      region?: string;
      windowCenter?: number;
      windowWidth?: number;
      imageQuality?: number;
      contentType?: string;
      transferSyntax?: string;
    } = {},
  ): string {
    const wadoConfig = this.config.wadoURI;
    if (!wadoConfig) {
      throw new Error('WADO-URI configuration not provided');
    }

    const url = new URL(`${wadoConfig.baseUrl}/wado`);

    // Required parameters
    url.searchParams.set('requestType', 'WADO');
    url.searchParams.set(wadoConfig.studyParam || 'studyUID', studyUID);
    url.searchParams.set(wadoConfig.seriesParam || 'seriesUID', seriesUID);
    url.searchParams.set(wadoConfig.objectParam || 'objectUID', objectUID);

    // Optional parameters
    if (options.rows) {
      url.searchParams.set('rows', options.rows.toString());
    }
    if (options.columns) {
      url.searchParams.set('columns', options.columns.toString());
    }
    if (options.region) {
      url.searchParams.set('region', options.region);
    }
    if (options.windowCenter !== undefined) {
      url.searchParams.set('windowCenter', options.windowCenter.toString());
    }
    if (options.windowWidth !== undefined) {
      url.searchParams.set('windowWidth', options.windowWidth.toString());
    }
    if (options.imageQuality) {
      url.searchParams.set('imageQuality', options.imageQuality.toString());
    }

    // Content type and transfer syntax
    url.searchParams.set('contentType', options.contentType || wadoConfig.contentType || 'application/dicom');
    if (options.transferSyntax || wadoConfig.transferSyntax) {
      url.searchParams.set('transferSyntax', options.transferSyntax || wadoConfig.transferSyntax!);
    }

    return url.toString();
  }

  public async retrieveImage(
    studyUID: string,
    seriesUID: string,
    objectUID: string,
    options: LoadOptions = {},
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    const _requestId = `${studyUID}-${seriesUID}-${objectUID}`;

    try {
      const url = this.buildWADOURIUrl(studyUID, seriesUID, objectUID);

      const request: WADORequest = {
        url,
        method: 'GET',
        timeout: 30000,
        retryAttempts: this.retryConfig.maxAttempts,
      };

      // Add authentication headers
      if (this.authConfig) {
        request.headers = await this.buildAuthHeaders();
      }

      // Create abort controller
      const abortController = new AbortController();
      this.activeRequests.set(_requestId, abortController);

      // Link external abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          abortController.abort();
        });
      }

      // Execute request with retry logic
      const response = await this.executeRequestWithRetry(request, abortController, progressCallback);

      return response;

    } catch (error) {
      log.error('WADO-URI image retrieval failed', {
        component: 'WADOURIHandler',
        metadata: { studyUID, seriesUID, objectUID },
      }, error as Error);
      throw error;
    } finally {
      this.activeRequests.delete(_requestId);
    }
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!this.authConfig) return headers;

    switch (this.authConfig.type) {
      case 'basic':
        if (this.authConfig.credentials?.username && this.authConfig.credentials?.password) {
          const credentials = btoa(`${this.authConfig.credentials.username}:${this.authConfig.credentials.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (this.authConfig.credentials?.token) {
          headers['Authorization'] = `Bearer ${this.authConfig.credentials.token}`;
        }
        break;

      case 'custom':
        if (this.authConfig.headerProvider) {
          const customHeaders = await this.authConfig.headerProvider();
          Object.assign(headers, customHeaders);
        }
        break;
    }

    return headers;
  }

  private async executeRequestWithRetry(
    request: WADORequest,
    abortController: AbortController,
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        // Check for abort
        if (abortController.signal.aborted) {
          throw new Error('Request cancelled');
        }

        // Execute fetch request
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          signal: abortController.signal,
        });

        // Check if we should retry
        if (!response.ok && this.retryConfig.retryCondition?.(response) && attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
            this.retryConfig.maxDelay,
          );

          log.warn('WADO-URI request failed, retrying', {
            component: 'WADOURIHandler',
            metadata: {
              attempt,
              maxAttempts: this.retryConfig.maxAttempts,
              status: response.status,
              delay,
            },
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Response.headers
          responseHeaders[key] = value;
        });

        // Read response body with progress tracking
        const contentLength = response.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

        if (progressCallback && totalSize > 0) {
          progressCallback({
            imageId: request.url,
            loaded: 0,
            total: totalSize,
            percentage: 0,
            status: 'loading',
          });
        }

        const data = await response.arrayBuffer();

        if (progressCallback) {
          progressCallback({
            imageId: request.url,
            loaded: data.byteLength,
            total: totalSize || data.byteLength,
            percentage: 100,
            status: 'completed',
          });
        }

        return {
          data,
          headers: responseHeaders,
          status: response.status,
          contentType: response.headers.get('content-type') || 'application/dicom',
        };

      } catch (error) {
        lastError = error as Error;

        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Don't retry on abort or network errors that aren't retriable
        if (error instanceof Error && (
          error.name === 'AbortError' ||
          error.message.includes('cancelled') ||
          error.message.includes('network')
        )) {
          break;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
          this.retryConfig.maxDelay,
        );

        log.warn('WADO-URI request error, retrying', {
          component: 'WADOURIHandler',
          metadata: { attempt, maxAttempts: this.retryConfig.maxAttempts, delay },
        }, error as Error);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  public dispose(): void {
    // Cancel all active requests
    for (const [, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}

// ===== WADO-RS Handler =====

export class WADORSHandler {
  private config: DICOMLoaderConfig;
  private authConfig?: WADOAuthConfig;
  private retryConfig: WADORetryConfig;
  private activeRequests = new Map<string, AbortController>();

  constructor(
    config: DICOMLoaderConfig,
    authConfig?: WADOAuthConfig,
    retryConfig: Partial<WADORetryConfig> = {},
  ) {
    this.config = config;
    this.authConfig = authConfig;
    this.retryConfig = { ...DEFAULT_WADO_RETRY_CONFIG, ...retryConfig };
  }

  public buildWADORSUrl(
    studyUID: string,
    seriesUID?: string,
    objectUID?: string,
    endpoint: 'studies' | 'series' | 'instances' | 'frames' = 'instances',
  ): string {
    const wadoConfig = this.config.wadoRS;
    if (!wadoConfig) {
      throw new Error('WADO-RS configuration not provided');
    }

    let url = `${wadoConfig.baseUrl}/studies/${studyUID}`;

    switch (endpoint) {
      case 'studies':
        // URL is already complete
        break;
      case 'series':
        if (seriesUID) {
          url += `/series/${seriesUID}`;
        } else {
          url += '/series';
        }
        break;
      case 'instances':
        if (seriesUID && objectUID) {
          url += `/series/${seriesUID}/instances/${objectUID}`;
        } else if (seriesUID) {
          url += `/series/${seriesUID}/instances`;
        } else {
          url += '/instances';
        }
        break;
      case 'frames':
        if (seriesUID && objectUID) {
          url += `/series/${seriesUID}/instances/${objectUID}/frames/1`;
        } else {
          throw new Error('Frame endpoint requires both seriesUID and objectUID');
        }
        break;
    }

    return url;
  }

  public async retrieveInstance(
    studyUID: string,
    seriesUID: string,
    objectUID: string,
    options: LoadOptions = {},
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    const _requestId = `${studyUID}-${seriesUID}-${objectUID}`;

    try {
      const url = this.buildWADORSUrl(studyUID, seriesUID, objectUID, 'instances');

      const request: WADORequest = {
        url,
        method: 'GET',
        timeout: 30000,
        retryAttempts: this.retryConfig.maxAttempts,
        headers: {
          'Accept': this.config.wadoRS?.acceptHeader || 'application/dicom; transfer-syntax=*',
        },
      };

      // Add authentication headers
      if (this.authConfig) {
        const authHeaders = await this.buildAuthHeaders();
        request.headers = { ...request.headers, ...authHeaders };
      }

      // Create abort controller
      const abortController = new AbortController();
      this.activeRequests.set(_requestId, abortController);

      // Link external abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          abortController.abort();
        });
      }

      // Execute request with retry logic
      const response = await this.executeRequestWithRetry(request, abortController, progressCallback);

      return response;

    } catch (error) {
      log.error('WADO-RS instance retrieval failed', {
        component: 'WADORSHandler',
        metadata: { studyUID, seriesUID, objectUID },
      }, error as Error);
      throw error;
    } finally {
      this.activeRequests.delete(_requestId);
    }
  }

  public async retrieveRenderedFrame(
    studyUID: string,
    seriesUID: string,
    objectUID: string,
    frameNumber: number = 1,
    options: {
      rows?: number;
      columns?: number;
      region?: string;
      windowCenter?: number;
      windowWidth?: number;
      imageQuality?: number;
    } = {},
    loadOptions: LoadOptions = {},
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    const _requestId = `${studyUID}-${seriesUID}-${objectUID}-frame-${frameNumber}`;

    try {
      let url = this.buildWADORSUrl(studyUID, seriesUID, objectUID, 'frames').replace('/frames/1', `/frames/${frameNumber}/rendered`);

      // Add query parameters for rendering options
      const urlObj = new URL(url);
      if (options.rows) urlObj.searchParams.set('rows', options.rows.toString());
      if (options.columns) urlObj.searchParams.set('columns', options.columns.toString());
      if (options.region) urlObj.searchParams.set('region', options.region);
      if (options.windowCenter !== undefined) urlObj.searchParams.set('windowCenter', options.windowCenter.toString());
      if (options.windowWidth !== undefined) urlObj.searchParams.set('windowWidth', options.windowWidth.toString());
      if (options.imageQuality) urlObj.searchParams.set('quality', options.imageQuality.toString());

      url = urlObj.toString();

      const request: WADORequest = {
        url,
        method: 'GET',
        timeout: 30000,
        retryAttempts: this.retryConfig.maxAttempts,
        headers: {
          'Accept': 'image/jpeg, image/png',
        },
      };

      // Add authentication headers
      if (this.authConfig) {
        const authHeaders = await this.buildAuthHeaders();
        request.headers = { ...request.headers, ...authHeaders };
      }

      // Create abort controller
      const abortController = new AbortController();
      this.activeRequests.set(_requestId, abortController);

      // Link external abort signal
      if (loadOptions.signal) {
        loadOptions.signal.addEventListener('abort', () => {
          abortController.abort();
        });
      }

      // Execute request with retry logic
      const response = await this.executeRequestWithRetry(request, abortController, progressCallback);

      return response;

    } catch (error) {
      log.error('WADO-RS rendered frame retrieval failed', {
        component: 'WADORSHandler',
        metadata: { studyUID, seriesUID, objectUID, frameNumber },
      }, error as Error);
      throw error;
    } finally {
      this.activeRequests.delete(_requestId);
    }
  }

  public async retrieveMetadata(
    studyUID: string,
    seriesUID?: string,
    objectUID?: string,
    options: LoadOptions = {},
  ): Promise<DICOMMetadata[]> {
    const _requestId = `metadata-${studyUID}-${seriesUID || 'all'}-${objectUID || 'all'}`;

    try {
      let url = this.buildWADORSUrl(studyUID, seriesUID, objectUID, objectUID ? 'instances' : seriesUID ? 'series' : 'studies');
      url += '/metadata';

      const request: WADORequest = {
        url,
        method: 'GET',
        timeout: 30000,
        retryAttempts: this.retryConfig.maxAttempts,
        headers: {
          'Accept': 'application/dicom+json',
        },
      };

      // Add authentication headers
      if (this.authConfig) {
        const authHeaders = await this.buildAuthHeaders();
        request.headers = { ...request.headers, ...authHeaders };
      }

      // Create abort controller
      const abortController = new AbortController();
      this.activeRequests.set(_requestId, abortController);

      // Link external abort signal
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          abortController.abort();
        });
      }

      // Execute request
      const response = await this.executeRequestWithRetry(request, abortController);

      // Parse JSON metadata
      const jsonText = new TextDecoder().decode(response.data);
      const jsonData = JSON.parse(jsonText);

      // Convert to our metadata format
      const metadataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

      return metadataArray.map((item: any) => this.convertJSONToMetadata(item));

    } catch (error) {
      log.error('WADO-RS metadata retrieval failed', {
        component: 'WADORSHandler',
        metadata: { studyUID, seriesUID, objectUID },
      }, error as Error);
      throw error;
    } finally {
      this.activeRequests.delete(_requestId);
    }
  }

  private convertJSONToMetadata(jsonData: any): DICOMMetadata {

    const getValue = (tag: string) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe: accessing known DICOM tag properties
      const element = jsonData[tag];
      return element?.Value?.[0] || '';
    };

    return {
      studyInstanceUID: getValue('0020000D'),
      seriesInstanceUID: getValue('0020000E'),
      sopInstanceUID: getValue('00080018'),
      patientName: getValue('00100010'),
      patientID: getValue('00100020'),
      instanceNumber: parseInt(getValue('00200013')) || undefined,
      rows: parseInt(getValue('00280010')) || undefined,
      columns: parseInt(getValue('00280011')) || undefined,
      pixelSpacing: jsonData['00280030']?.Value || undefined,
      windowCenter: parseFloat(getValue('00281050')) || undefined,
      windowWidth: parseFloat(getValue('00281051')) || undefined,
    };
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!this.authConfig) return headers;

    switch (this.authConfig.type) {
      case 'basic':
        if (this.authConfig.credentials?.username && this.authConfig.credentials?.password) {
          const credentials = btoa(`${this.authConfig.credentials.username}:${this.authConfig.credentials.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;

      case 'bearer':
        if (this.authConfig.credentials?.token) {
          headers['Authorization'] = `Bearer ${this.authConfig.credentials.token}`;
        }
        break;

      case 'custom':
        if (this.authConfig.headerProvider) {
          const customHeaders = await this.authConfig.headerProvider();
          Object.assign(headers, customHeaders);
        }
        break;
    }

    return headers;
  }

  private async executeRequestWithRetry(
    request: WADORequest,
    abortController: AbortController,
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        // Check for abort
        if (abortController.signal.aborted) {
          throw new Error('Request cancelled');
        }

        // Execute fetch request
        const response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          signal: abortController.signal,
        });

        // Check if we should retry
        if (!response.ok && this.retryConfig.retryCondition?.(response) && attempt < this.retryConfig.maxAttempts) {
          const delay = Math.min(
            this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
            this.retryConfig.maxDelay,
          );

          log.warn('WADO-RS request failed, retrying', {
            component: 'WADORSHandler',
            metadata: {
              attempt,
              maxAttempts: this.retryConfig.maxAttempts,
              status: response.status,
              delay,
            },
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Handle multipart response if supported
        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('multipart/related') && this.config.wadoRS?.multipartSupport) {
          return this.parseMultipartResponse(response, progressCallback);
        }

        // Get response headers
        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Response.headers
          responseHeaders[key] = value;
        });

        // Read response body with progress tracking
        const contentLength = response.headers.get('content-length');
        const totalSize = contentLength ? parseInt(contentLength, 10) : 0;

        if (progressCallback && totalSize > 0) {
          progressCallback({
            imageId: request.url,
            loaded: 0,
            total: totalSize,
            percentage: 0,
            status: 'loading',
          });
        }

        const data = await response.arrayBuffer();

        if (progressCallback) {
          progressCallback({
            imageId: request.url,
            loaded: data.byteLength,
            total: totalSize || data.byteLength,
            percentage: 100,
            status: 'completed',
          });
        }

        return {
          data,
          headers: responseHeaders,
          status: response.status,
          contentType,
        };

      } catch (error) {
        lastError = error as Error;

        if (attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Don't retry on abort or network errors that aren't retriable
        if (error instanceof Error && (
          error.name === 'AbortError' ||
          error.message.includes('cancelled') ||
          error.message.includes('network')
        )) {
          break;
        }

        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
          this.retryConfig.maxDelay,
        );

        log.warn('WADO-RS request error, retrying', {
          component: 'WADORSHandler',
          metadata: { attempt, maxAttempts: this.retryConfig.maxAttempts, delay },
        }, error as Error);

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  private async parseMultipartResponse(
    response: Response,
    progressCallback?: (progress: LoadProgress) => void,
  ): Promise<WADOResponse> {
    // Simple multipart parsing - in a real implementation, you'd want a more robust parser
    const data = await response.arrayBuffer();

    if (progressCallback) {
      progressCallback({
        imageId: response.url,
        loaded: data.byteLength,
        total: data.byteLength,
        percentage: 100,
        status: 'completed',
      });
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Response.headers
      responseHeaders[key] = value;
    });

    return {
      data,
      headers: responseHeaders,
      status: response.status,
      contentType: response.headers.get('content-type') || 'multipart/related',
    };
  }

  public cancelRequest(requestId: string): boolean {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      return true;
    }
    return false;
  }

  public dispose(): void {
    // Cancel all active requests
    for (const [, controller] of this.activeRequests) {
      controller.abort();
    }
    this.activeRequests.clear();
  }
}

// ===== WADO Protocol Manager =====

export class WADOProtocolManager {
  private wadoURIHandler?: WADOURIHandler;
  private wadoRSHandler?: WADORSHandler;
  private config: DICOMLoaderConfig;

  constructor(config: DICOMLoaderConfig) {
    this.config = config;
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    if (this.config.wadoURI) {
      this.wadoURIHandler = new WADOURIHandler(this.config);
      log.info('WADO-URI handler initialized', {
        component: 'WADOProtocolManager',
        metadata: { baseUrl: this.config.wadoURI.baseUrl },
      });
    }

    if (this.config.wadoRS) {
      this.wadoRSHandler = new WADORSHandler(this.config);
      log.info('WADO-RS handler initialized', {
        component: 'WADOProtocolManager',
        metadata: { baseUrl: this.config.wadoRS.baseUrl },
      });
    }
  }

  public getWADOURIHandler(): WADOURIHandler | null {
    return this.wadoURIHandler || null;
  }

  public getWADORSHandler(): WADORSHandler | null {
    return this.wadoRSHandler || null;
  }

  public updateConfig(config: Partial<DICOMLoaderConfig>): void {
    this.config = { ...this.config, ...config };

    // Reinitialize handlers if configuration changed
    if (config.wadoURI || config.wadoRS) {
      this.dispose();
      this.initializeHandlers();
    }
  }

  public dispose(): void {
    if (this.wadoURIHandler) {
      this.wadoURIHandler.dispose();
      this.wadoURIHandler = undefined;
    }

    if (this.wadoRSHandler) {
      this.wadoRSHandler.dispose();
      this.wadoRSHandler = undefined;
    }

    log.info('WADO Protocol Manager disposed', {
      component: 'WADOProtocolManager',
    });
  }
}
