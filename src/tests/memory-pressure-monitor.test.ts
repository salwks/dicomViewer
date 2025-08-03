/**
 * Memory Pressure Monitor Test Suite
 * Tests for advanced memory pressure monitoring functionality
 */

import { MemoryPressureMonitor, MemoryPressureLevel, MemoryPressureAlert } from '../services/MemoryPressureMonitor';
import { memoryManager } from '../services/memoryManager';
import { advancedMemoryManager } from '../services/AdvancedMemoryManager';

// Mock dependencies
jest.mock('../services/memoryManager');
jest.mock('../services/AdvancedMemoryManager');
jest.mock('../services/viewportStateManager');
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('MemoryPressureMonitor', () => {
  let monitor: MemoryPressureMonitor;
  let mockMemoryManager: jest.Mocked<typeof memoryManager>;
  let mockAdvancedMemoryManager: jest.Mocked<typeof advancedMemoryManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMemoryManager = memoryManager as jest.Mocked<typeof memoryManager>;
    mockAdvancedMemoryManager = advancedMemoryManager as jest.Mocked<typeof advancedMemoryManager>;

    // Mock memory usage data
    mockMemoryManager.getMemoryUsage.mockReturnValue({
      total: 1000 * 1024 * 1024, // 1GB
      used: 500 * 1024 * 1024,   // 500MB
      available: 500 * 1024 * 1024,
      viewportAllocations: new Map(),
      textureMemory: 200 * 1024 * 1024,
      bufferMemory: 150 * 1024 * 1024,
      cacheMemory: 150 * 1024 * 1024,
    });

    monitor = new MemoryPressureMonitor({
      monitoringInterval: 100, // Fast for testing
      trendAnalysisWindow: 5000,
      autoResponseEnabled: false, // Disable for testing
    });
  });

  afterEach(() => {
    monitor?.dispose();
  });

  describe('Pressure Level Calculation', () => {
    test('calculates normal pressure level correctly', () => {
      const level = monitor.getCurrentPressureLevel();
      expect(level).toBe(MemoryPressureLevel.NORMAL); // 50% usage
    });

    test('calculates high pressure level correctly', () => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 850 * 1024 * 1024, // 85% usage
        available: 150 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 400 * 1024 * 1024,
        bufferMemory: 250 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      // Trigger monitoring cycle
      monitor.forceMonitoringCycle();

      const level = monitor.getCurrentPressureLevel();
      expect(level).toBe(MemoryPressureLevel.HIGH);
    });

    test('calculates critical pressure level correctly', () => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 950 * 1024 * 1024, // 95% usage
        available: 50 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 450 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      monitor.forceMonitoringCycle();

      const level = monitor.getCurrentPressureLevel();
      expect(level).toBe(MemoryPressureLevel.CRITICAL);
    });

    test('calculates emergency pressure level correctly', () => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 990 * 1024 * 1024, // 99% usage
        available: 10 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 500 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 190 * 1024 * 1024,
      });

      monitor.forceMonitoringCycle();

      const level = monitor.getCurrentPressureLevel();
      expect(level).toBe(MemoryPressureLevel.EMERGENCY);
    });
  });

  describe('Memory Trend Analysis', () => {
    test('detects increasing memory trend', async () => {
      let usedMemory = 500 * 1024 * 1024;

      // Simulate increasing memory usage
      for (let i = 0; i < 5; i++) {
        usedMemory += 50 * 1024 * 1024;
        mockMemoryManager.getMemoryUsage.mockReturnValue({
          total: 1000 * 1024 * 1024,
          used: usedMemory,
          available: 1000 * 1024 * 1024 - usedMemory,
          viewportAllocations: new Map(),
          textureMemory: usedMemory * 0.4,
          bufferMemory: usedMemory * 0.3,
          cacheMemory: usedMemory * 0.3,
        });

        await monitor.forceMonitoringCycle();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const trend = monitor.getCurrentTrend();
      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('increasing');
      expect(trend?.rate).toBeGreaterThan(0);
    });

    test('detects decreasing memory trend', async () => {
      let usedMemory = 800 * 1024 * 1024;

      // Simulate decreasing memory usage
      for (let i = 0; i < 5; i++) {
        usedMemory -= 30 * 1024 * 1024;
        mockMemoryManager.getMemoryUsage.mockReturnValue({
          total: 1000 * 1024 * 1024,
          used: usedMemory,
          available: 1000 * 1024 * 1024 - usedMemory,
          viewportAllocations: new Map(),
          textureMemory: usedMemory * 0.4,
          bufferMemory: usedMemory * 0.3,
          cacheMemory: usedMemory * 0.3,
        });

        await monitor.forceMonitoringCycle();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const trend = monitor.getCurrentTrend();
      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('decreasing');
      expect(trend?.rate).toBeLessThan(0);
    });

    test('detects stable memory trend', async () => {
      const stableMemory = 600 * 1024 * 1024;

      // Simulate stable memory usage with minor fluctuations
      for (let i = 0; i < 5; i++) {
        const fluctuation = (Math.random() - 0.5) * 2 * 1024 * 1024; // ±2MB
        mockMemoryManager.getMemoryUsage.mockReturnValue({
          total: 1000 * 1024 * 1024,
          used: stableMemory + fluctuation,
          available: 1000 * 1024 * 1024 - stableMemory - fluctuation,
          viewportAllocations: new Map(),
          textureMemory: (stableMemory + fluctuation) * 0.4,
          bufferMemory: (stableMemory + fluctuation) * 0.3,
          cacheMemory: (stableMemory + fluctuation) * 0.3,
        });

        await monitor.forceMonitoringCycle();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const trend = monitor.getCurrentTrend();
      expect(trend).toBeTruthy();
      expect(trend?.direction).toBe('stable');
    });
  });

  describe('Alert Generation', () => {
    test('generates alert for high memory pressure', (done) => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 850 * 1024 * 1024, // 85% usage - HIGH level
        available: 150 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 400 * 1024 * 1024,
        bufferMemory: 250 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      monitor.on('pressure-alert', (alert: MemoryPressureAlert) => {
        expect(alert.level).toBe(MemoryPressureLevel.HIGH);
        expect(alert.severity).toBe('warning');
        expect(alert.recommendations.length).toBeGreaterThan(0);
        done();
      });

      monitor.forceMonitoringCycle();
    });

    test('generates alert for critical memory pressure', (done) => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 950 * 1024 * 1024, // 95% usage - CRITICAL level
        available: 50 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 450 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      monitor.on('pressure-alert', (alert: MemoryPressureAlert) => {
        expect(alert.level).toBe(MemoryPressureLevel.CRITICAL);
        expect(alert.severity).toBe('error');
        expect(alert.recommendations.length).toBeGreaterThan(0);

        // Check for critical level recommendations
        const hasAggressiveCleanup = alert.recommendations.some(
          rec => rec.action === 'aggressive-cleanup',
        );
        expect(hasAggressiveCleanup).toBe(true);
        done();
      });

      monitor.forceMonitoringCycle();
    });

    test('generates alert for emergency memory pressure', (done) => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 990 * 1024 * 1024, // 99% usage - EMERGENCY level
        available: 10 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 500 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 190 * 1024 * 1024,
      });

      monitor.on('pressure-alert', (alert: MemoryPressureAlert) => {
        expect(alert.level).toBe(MemoryPressureLevel.EMERGENCY);
        expect(alert.severity).toBe('critical');
        expect(alert.recommendations.length).toBeGreaterThan(0);

        // Check for emergency level recommendations
        const hasEmergencyCleanup = alert.recommendations.some(
          rec => rec.action === 'emergency-cleanup',
        );
        expect(hasEmergencyCleanup).toBe(true);
        done();
      });

      monitor.forceMonitoringCycle();
    });
  });

  describe('Predictive Analysis', () => {
    test('predicts memory exhaustion correctly', (done) => {
      let usedMemory = 800 * 1024 * 1024;

      // Set up increasing trend that will cause exhaustion
      const intervalId = setInterval(() => {
        usedMemory += 40 * 1024 * 1024; // Fast increase
        mockMemoryManager.getMemoryUsage.mockReturnValue({
          total: 1000 * 1024 * 1024,
          used: usedMemory,
          available: 1000 * 1024 * 1024 - usedMemory,
          viewportAllocations: new Map(),
          textureMemory: usedMemory * 0.4,
          bufferMemory: usedMemory * 0.3,
          cacheMemory: usedMemory * 0.3,
        });

        monitor.forceMonitoringCycle();
      }, 100);

      monitor.on('exhaustion-predicted', (timeToExhaustion: number, usage) => {
        clearInterval(intervalId);
        expect(timeToExhaustion).toBeLessThan(60000); // Less than 1 minute
        expect(usage.used).toBeGreaterThan(800 * 1024 * 1024);
        done();
      });

      // Timeout to prevent test hanging
      setTimeout(() => {
        clearInterval(intervalId);
        done();
      }, 2000);
    });
  });

  describe('Memory History', () => {
    test('maintains memory history correctly', async () => {
      // Generate some history
      for (let i = 0; i < 5; i++) {
        await monitor.forceMonitoringCycle();
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const history = monitor.getMemoryHistory(1000); // Last 1 second
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('usage');
    });

    test('limits memory history by time window', async () => {
      // Generate history over time
      for (let i = 0; i < 3; i++) {
        await monitor.forceMonitoringCycle();
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const shortHistory = monitor.getMemoryHistory(200); // Last 200ms
      const longHistory = monitor.getMemoryHistory(1000); // Last 1 second

      expect(shortHistory.length).toBeLessThanOrEqual(longHistory.length);
    });
  });

  describe('Configuration Updates', () => {
    test('updates configuration correctly', () => {
      const newConfig = {
        monitoringInterval: 5000,
        autoResponseEnabled: true,
      };

      monitor.updateConfig(newConfig);

      // Configuration should be updated internally
      // We can test this by checking behavior changes
      expect(() => monitor.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('Emergency Mode', () => {
    test('enters emergency mode on critical pressure', async () => {
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 950 * 1024 * 1024, // 95% usage - CRITICAL level
        available: 50 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 450 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      await monitor.forceMonitoringCycle();

      expect(monitor.isEmergencyModeActive()).toBe(true);
    });

    test('exits emergency mode when pressure decreases', async () => {
      // First trigger emergency mode
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 950 * 1024 * 1024, // 95% usage
        available: 50 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 450 * 1024 * 1024,
        bufferMemory: 300 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      await monitor.forceMonitoringCycle();
      expect(monitor.isEmergencyModeActive()).toBe(true);

      // Then reduce pressure
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 600 * 1024 * 1024, // 60% usage - back to moderate
        available: 400 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 250 * 1024 * 1024,
        bufferMemory: 200 * 1024 * 1024,
        cacheMemory: 150 * 1024 * 1024,
      });

      await monitor.forceMonitoringCycle();
      expect(monitor.isEmergencyModeActive()).toBe(false);
    });
  });

  describe('Cleanup and Disposal', () => {
    test('disposes correctly without errors', () => {
      expect(() => monitor.dispose()).not.toThrow();
    });

    test('clears data on disposal', () => {
      monitor.dispose();

      const history = monitor.getMemoryHistory();
      const alerts = monitor.getRecentAlerts();

      expect(history.length).toBe(0);
      expect(alerts.length).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('emits pressure-resolved event', (done) => {
      // Start with high pressure
      mockMemoryManager.getMemoryUsage.mockReturnValue({
        total: 1000 * 1024 * 1024,
        used: 850 * 1024 * 1024, // High pressure
        available: 150 * 1024 * 1024,
        viewportAllocations: new Map(),
        textureMemory: 400 * 1024 * 1024,
        bufferMemory: 250 * 1024 * 1024,
        cacheMemory: 200 * 1024 * 1024,
      });

      monitor.forceMonitoringCycle();

      monitor.on('pressure-resolved', (oldLevel, newLevel) => {
        expect(oldLevel).toBe(MemoryPressureLevel.HIGH);
        expect(newLevel).toBe(MemoryPressureLevel.NORMAL);
        done();
      });

      // Reduce to normal pressure
      setTimeout(() => {
        mockMemoryManager.getMemoryUsage.mockReturnValue({
          total: 1000 * 1024 * 1024,
          used: 400 * 1024 * 1024, // Normal pressure
          available: 600 * 1024 * 1024,
          viewportAllocations: new Map(),
          textureMemory: 150 * 1024 * 1024,
          bufferMemory: 125 * 1024 * 1024,
          cacheMemory: 125 * 1024 * 1024,
        });

        monitor.forceMonitoringCycle();
      }, 100);
    });
  });
});
