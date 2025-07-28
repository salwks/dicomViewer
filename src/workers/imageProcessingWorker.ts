/**
 * Image Processing Web Worker
 * Handles heavy image processing tasks in a separate thread
 */

/* eslint-disable security/detect-object-injection */

// Define message types for type safety
export interface WorkerMessage {
  type: string;
  id: string;
  data?: any;
}

export interface ImageProcessingTask {
  type: 'decompress' | 'transform' | 'filter' | 'analyze' | 'segment';
  imageId: string;
  data: ArrayBuffer | Uint8Array | Uint16Array;
  options?: any;
}

export interface ProcessingResult {
  imageId: string;
  result: any;
  processingTime: number;
  error?: string;
}

// Worker context (this will run in the worker thread)
declare const self: DedicatedWorkerGlobalScope;

class ImageProcessingWorker {
  private processingQueue: ImageProcessingTask[] = [];
  private isProcessing = false;

  constructor() {
    if (typeof self !== 'undefined' && 'onmessage' in self) {
      (self as any).onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleMessage(event.data);
      };
    }
  }

  private handleMessage(message: WorkerMessage): void {
    const { type, id, data } = message;

    switch (type) {
      case 'process':
        this.queueTask(data as ImageProcessingTask);
        break;
      case 'cancel':
        this.cancelTask(id);
        break;
      case 'clear':
        this.clearQueue();
        break;
      default:
        this.sendError(id, `Unknown message type: ${type}`);
    }
  }

  private queueTask(task: ImageProcessingTask): void {
    this.processingQueue.push(task);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const task = this.processingQueue.shift()!;
      await this.processTask(task);
    }

    this.isProcessing = false;
  }

  private async processTask(task: ImageProcessingTask): Promise<void> {
    const startTime = performance.now();

    try {
      let result: any;

      switch (task.type) {
        case 'decompress':
          result = await this.decompressImage(task.data, task.options);
          break;
        case 'transform':
          result = await this.transformImage(task.data, task.options);
          break;
        case 'filter':
          result = await this.filterImage(task.data, task.options);
          break;
        case 'analyze':
          result = await this.analyzeImage(task.data, task.options);
          break;
        case 'segment':
          result = await this.segmentImage(task.data, task.options);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      const processingTime = performance.now() - startTime;

      this.sendResult({
        imageId: task.imageId,
        result,
        processingTime,
      });

    } catch (error) {
      const processingTime = performance.now() - startTime;

      this.sendResult({
        imageId: task.imageId,
        result: null,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Decompress image data
   */
  private async decompressImage(data: ArrayBuffer | Uint8Array | Uint16Array, _options: any = {}): Promise<any> {
    // Simulate decompression processing
    await this.simulateProcessing(50, 200);

    if (data instanceof ArrayBuffer) {
      return new Uint16Array(data);
    } else if (data instanceof Uint8Array) {
      // Convert 8-bit to 16-bit
      const result = new Uint16Array(data.length);
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] * 256; // Scale to 16-bit
      }
      return result;
    }

    return data;
  }

  /**
   * Transform image (rotate, flip, scale)
   */
  private async transformImage(data: ArrayBuffer | Uint8Array | Uint16Array, options: any = {}): Promise<any> {
    const { transform = 'none' } = options;

    await this.simulateProcessing(30, 150);

    let pixelData: Uint16Array;

    if (data instanceof ArrayBuffer) {
      pixelData = new Uint16Array(data);
    } else if (data instanceof Uint8Array) {
      pixelData = new Uint16Array(data.length);
      for (let i = 0; i < data.length; i++) {
        pixelData[i] = data[i] * 256;
      }
    } else {
      pixelData = new Uint16Array(data);
    }

    const width = options.width || 512;
    const height = options.height || 512;

    switch (transform) {
      case 'rotate90':
        return this.rotateImage90(pixelData, width, height);
      case 'rotate180':
        return this.rotateImage180(pixelData, width, height);
      case 'rotate270':
        return this.rotateImage270(pixelData, width, height);
      case 'flipH':
        return this.flipImageHorizontal(pixelData, width, height);
      case 'flipV':
        return this.flipImageVertical(pixelData, width, height);
      default:
        return pixelData;
    }
  }

  /**
   * Apply filters to image
   */
  private async filterImage(data: ArrayBuffer | Uint8Array | Uint16Array, options: any = {}): Promise<any> {
    const { filter = 'none', strength = 1.0 } = options;

    await this.simulateProcessing(40, 180);

    let pixelData: Uint16Array;

    if (data instanceof ArrayBuffer) {
      pixelData = new Uint16Array(data);
    } else if (data instanceof Uint8Array) {
      pixelData = new Uint16Array(data.length);
      for (let i = 0; i < data.length; i++) {
        pixelData[i] = data[i] * 256;
      }
    } else {
      pixelData = new Uint16Array(data);
    }

    switch (filter) {
      case 'sharpen':
        return this.sharpenFilter(pixelData, strength);
      case 'blur':
        return this.blurFilter(pixelData, strength);
      case 'edge':
        return this.edgeDetectionFilter(pixelData);
      case 'denoise':
        return this.denoiseFilter(pixelData, strength);
      default:
        return pixelData;
    }
  }

  /**
   * Analyze image properties
   */
  private async analyzeImage(data: ArrayBuffer | Uint8Array | Uint16Array, _options: any = {}): Promise<any> {
    await this.simulateProcessing(60, 250);

    let pixelData: Uint16Array;

    if (data instanceof ArrayBuffer) {
      pixelData = new Uint16Array(data);
    } else if (data instanceof Uint8Array) {
      pixelData = new Uint16Array(data.length);
      for (let i = 0; i < data.length; i++) {
        pixelData[i] = data[i] * 256;
      }
    } else {
      pixelData = new Uint16Array(data);
    }

    return {
      histogram: this.calculateHistogram(pixelData),
      statistics: this.calculateStatistics(pixelData),
      windowLevel: this.calculateOptimalWindowLevel(pixelData),
    };
  }

  /**
   * Segment image regions
   */
  private async segmentImage(data: ArrayBuffer | Uint8Array | Uint16Array, options: any = {}): Promise<any> {
    const { method = 'threshold', threshold = 100 } = options;

    await this.simulateProcessing(100, 500);

    let pixelData: Uint16Array;

    if (data instanceof ArrayBuffer) {
      pixelData = new Uint16Array(data);
    } else if (data instanceof Uint8Array) {
      pixelData = new Uint16Array(data.length);
      for (let i = 0; i < data.length; i++) {
        pixelData[i] = data[i] * 256;
      }
    } else {
      pixelData = new Uint16Array(data);
    }

    switch (method) {
      case 'threshold':
        return this.thresholdSegmentation(pixelData, threshold);
      case 'region_growing':
        return this.regionGrowingSegmentation(pixelData, options);
      default:
        return this.thresholdSegmentation(pixelData, threshold);
    }
  }

  // Helper methods for image processing

  private async simulateProcessing(minTime: number, maxTime: number): Promise<void> {
    const delay = Math.random() * (maxTime - minTime) + minTime;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private rotateImage90(data: Uint16Array, width: number, height: number): Uint16Array {
    const result = new Uint16Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = x * height + (height - 1 - y);
        result[dstIndex] = data[srcIndex];
      }
    }
    return result;
  }

  private rotateImage180(data: Uint16Array, _width: number, _height: number): Uint16Array {
    const result = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[data.length - 1 - i] = data[i];
    }
    return result;
  }

  private rotateImage270(data: Uint16Array, width: number, height: number): Uint16Array {
    const result = new Uint16Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = (width - 1 - x) * height + y;
        result[dstIndex] = data[srcIndex];
      }
    }
    return result;
  }

  private flipImageHorizontal(data: Uint16Array, width: number, height: number): Uint16Array {
    const result = new Uint16Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = y * width + (width - 1 - x);
        result[dstIndex] = data[srcIndex];
      }
    }
    return result;
  }

  private flipImageVertical(data: Uint16Array, width: number, height: number): Uint16Array {
    const result = new Uint16Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = y * width + x;
        const dstIndex = (height - 1 - y) * width + x;
        result[dstIndex] = data[srcIndex];
      }
    }
    return result;
  }

  private sharpenFilter(data: Uint16Array, strength: number): Uint16Array {
    // Simple sharpening filter simulation
    const result = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const enhanced = data[i] * (1 + strength * 0.5);
      result[i] = Math.min(65535, Math.max(0, enhanced));
    }
    return result;
  }

  private blurFilter(data: Uint16Array, strength: number): Uint16Array {
    // Simple blur filter simulation
    const result = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const blurred = data[i] * (1 - strength * 0.3);
      result[i] = Math.min(65535, Math.max(0, blurred));
    }
    return result;
  }

  private edgeDetectionFilter(data: Uint16Array): Uint16Array {
    // Simple edge detection simulation
    const result = new Uint16Array(data.length);
    for (let i = 1; i < data.length - 1; i++) {
      const gradient = Math.abs(data[i + 1] - data[i - 1]);
      result[i] = Math.min(65535, gradient * 4);
    }
    return result;
  }

  private denoiseFilter(data: Uint16Array, strength: number): Uint16Array {
    // Simple denoising simulation
    const result = new Uint16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      // Reduce noise by averaging nearby values
      const denoised = data[i] * (1 - strength * 0.1) + (data[i] * strength * 0.1);
      result[i] = Math.min(65535, Math.max(0, denoised));
    }
    return result;
  }

  private calculateHistogram(data: Uint16Array): number[] {
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
      const bin = Math.floor((data[i] / 65535) * 255);
      histogram[bin]++;
    }
    return histogram;
  }

  private calculateStatistics(data: Uint16Array): any {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const value = data[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
    }

    const mean = sum / data.length;
    let sumSquaredDiff = 0;

    for (let i = 0; i < data.length; i++) {
      const diff = data[i] - mean;
      sumSquaredDiff += diff * diff;
    }

    const variance = sumSquaredDiff / data.length;
    const stdDev = Math.sqrt(variance);

    return {
      min,
      max,
      mean,
      variance,
      stdDev,
      count: data.length,
    };
  }

  private calculateOptimalWindowLevel(data: Uint16Array): any {
    const stats = this.calculateStatistics(data);

    // Calculate optimal window/level based on statistics
    const window = stats.stdDev * 4; // 4 standard deviations
    const level = stats.mean;

    return {
      window,
      level,
      min: level - window / 2,
      max: level + window / 2,
    };
  }

  private thresholdSegmentation(data: Uint16Array, threshold: number): Uint8Array {
    const result = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      result[i] = data[i] > threshold ? 255 : 0;
    }
    return result;
  }

  private regionGrowingSegmentation(data: Uint16Array, options: any): Uint8Array {
    const { seedPoints = [{ x: 256, y: 256 }], tolerance = 100 } = options;
    const width = options.width || 512;
    const result = new Uint8Array(data.length);

    // Simple region growing simulation
    for (let i = 0; i < data.length; i++) {
      // Simulate region growing around seed points
      const value = data[i];
      const inRegion = seedPoints.some((seed: any) => {
        const distance = Math.abs(value - (data[seed.y * width + seed.x] || 0));
        return distance <= tolerance;
      });
      result[i] = inRegion ? 255 : 0;
    }

    return result;
  }

  private cancelTask(imageId: string): void {
    const index = this.processingQueue.findIndex(task => task.imageId === imageId);
    if (index >= 0) {
      this.processingQueue.splice(index, 1);
      this.sendMessage({
        type: 'cancelled',
        id: imageId,
      });
    }
  }

  private clearQueue(): void {
    const cancelledCount = this.processingQueue.length;
    this.processingQueue.length = 0;

    this.sendMessage({
      type: 'queue_cleared',
      id: 'worker',
      data: { cancelledCount },
    });
  }

  private sendResult(result: ProcessingResult): void {
    this.sendMessage({
      type: 'result',
      id: result.imageId,
      data: result,
    });
  }

  private sendError(id: string, error: string): void {
    this.sendMessage({
      type: 'error',
      id,
      data: { error },
    });
  }

  private sendMessage(message: WorkerMessage): void {
    self.postMessage(message);
  }
}

// Initialize worker
if (typeof self !== 'undefined') {
  new ImageProcessingWorker();
}
