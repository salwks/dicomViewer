/**
 * Rendering Web Worker
 * Handles asynchronous rendering operations for viewport optimization
 */

interface RenderConfig {
  quality: 'low' | 'medium' | 'high';
  antialiasing: boolean;
  colorSpace: 'sRGB' | 'P3' | 'Rec2020';
  pixelRatio: number;
  enableHardwareAcceleration: boolean;
}

interface RenderFrame {
  id: string;
  viewportId: string;
  priority: number;
  complexity: number;
  timestamp: number;
  data: ArrayBuffer | ImageData | Uint8Array | Uint16Array;
}

interface WorkerMessage {
  type: 'render' | 'cancel' | 'init';
  frame?: RenderFrame;
  frameId?: string;
  config?: RenderConfig;
}

interface WorkerResponse {
  type: 'render-complete' | 'render-error' | 'init-complete';
  frameId: string;
  success: boolean;
  renderTime?: number;
  error?: string;
  result?: {
    renderedData?: ArrayBuffer | ImageData;
    renderTime: number;
    quality: string;
    [key: string]: any;
  };
}

// Worker state
let isInitialized = false;
const renderingFrames = new Set<string>();

// Main message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, frame, frameId, config } = event.data;

  try {
    switch (type) {
      case 'init':
        await initializeWorker(config);
        postResponse({
          type: 'init-complete',
          frameId: '',
          success: true,
        });
        break;

      case 'render':
        if (frame) {
          await processRenderFrame(frame);
        }
        break;

      case 'cancel':
        if (frameId) {
          renderingFrames.delete(frameId);
        }
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postResponse({
      type: 'render-error',
      frameId: frameId || frame?.id || '',
      success: false,
      error: (error as Error).message,
    });
  }
};

async function initializeWorker(_config: RenderConfig): Promise<void> {
  // Initialize worker state
  isInitialized = true;
  renderingFrames.clear();

  // Simulate initialization work
  await new Promise(resolve => setTimeout(resolve, 100));
}

async function processRenderFrame(frame: RenderFrame): Promise<void> {
  if (!isInitialized) {
    throw new Error('Worker not initialized');
  }

  const startTime = performance.now();
  renderingFrames.add(frame.id);

  try {
    // Simulate actual rendering work based on frame complexity
    const renderTime = calculateRenderTime(frame);
    await simulateRenderingWork(renderTime);

    // Check if frame was cancelled during rendering
    if (!renderingFrames.has(frame.id)) {
      return; // Frame was cancelled
    }

    const totalTime = performance.now() - startTime;

    postResponse({
      type: 'render-complete',
      frameId: frame.id,
      success: true,
      renderTime: totalTime,
      result: {
        viewportId: frame.viewportId,
        frameId: frame.id,
        renderedAt: Date.now(),
        performance: {
          renderTime: totalTime,
          complexity: frame.complexity,
          priority: frame.priority,
        },
      },
    });
  } finally {
    renderingFrames.delete(frame.id);
  }
}

function calculateRenderTime(frame: RenderFrame): number {
  // Base render time calculation
  const baseTime = 16; // 16ms for 60fps target
  const complexityMultiplier = 1 + frame.complexity / 10;
  const priorityBonus = frame.priority > 7 ? 0.8 : 1.0; // High priority gets bonus

  return Math.max(5, baseTime * complexityMultiplier * priorityBonus);
}

async function simulateRenderingWork(renderTime: number): Promise<void> {
  // Simulate CPU-intensive rendering work
  const endTime = performance.now() + renderTime;

  while (performance.now() < endTime) {
    // Simulate work by performing some calculations
    Math.random() * Math.random();

    // Yield occasionally to prevent blocking
    if (Math.random() < 0.01) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

function postResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

// Export for TypeScript
export {};
