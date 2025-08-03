/**
 * Advanced Memory Manager Service
 * Enhanced memory allocation and deallocation for viewport resources
 * Task 30.2: Develop Memory Management System
 */

import { EventEmitter } from 'events';
import { ViewportState } from '../types/viewportState';
// Import used for reference - CleanupPriority used in comments and future integration
import { log } from '../utils/logger';

export interface MemoryPool {
  id: string;
  name: string;
  type: 'texture' | 'buffer' | 'geometry' | 'shader' | 'image';
  maxSize: number;
  currentSize: number;
  allocatedBlocks: MemoryBlock[];
  freeBlocks: MemoryBlock[];
  fragmentationRatio: number;
  defragmentationThreshold: number;
}

export interface MemoryBlock {
  id: string;
  poolId: string;
  offset: number;
  size: number;
  isAllocated: boolean;
  viewportId?: string;
  resourceId?: string;
  allocatedAt: number;
  lastAccessed: number;
  accessCount: number;
  priority: number;
}

export interface ViewportMemoryProfile {
  viewportId: string;
  allocatedMemory: number;
  maxMemory: number;
  memoryBlocks: MemoryBlock[];
  memoryPools: string[];
  retentionPolicy: RetentionPolicy;
  compressionRatio: number;
  lastOptimization: number;
}

export interface RetentionPolicy {
  maxAge: number; // milliseconds
  maxUnusedTime: number; // milliseconds
  compressionEnabled: boolean;
  autoCleanup: boolean;
  priorityBoost: number;
}

export interface MemoryAllocationRequest {
  size: number;
  type: 'texture' | 'buffer' | 'geometry' | 'shader' | 'image';
  viewportId: string;
  priority: number;
  alignment?: number;
  persistent?: boolean;
  compressible?: boolean;
}

export interface MemoryAllocationResult {
  success: boolean;
  blockId?: string;
  offset?: number;
  actualSize?: number;
  poolId?: string;
  error?: string;
  alternatives?: MemoryAllocationResult[];
}

export interface MemoryOptimizationStrategy {
  name: string;
  description: string;
  threshold: number; // Memory usage ratio to trigger
  priority: number;
  execute: (manager: AdvancedMemoryManager, viewports: ViewportState[]) => Promise<number>; // Returns bytes freed
}

export interface AdvancedMemoryConfig {
  poolSizes: {
    texture: number;
    buffer: number;
    geometry: number;
    shader: number;
    image: number;
  };
  allocationStrategy: 'first-fit' | 'best-fit' | 'worst-fit' | 'buddy-system';
  defragmentationEnabled: boolean;
  defragmentationThreshold: number;
  compressionEnabled: boolean;
  compressionThreshold: number;
  predictiveAllocation: boolean;
  memoryLeakDetection: boolean;
  optimizationStrategies: MemoryOptimizationStrategy[];
}

export const DEFAULT_ADVANCED_MEMORY_CONFIG: AdvancedMemoryConfig = {
  poolSizes: {
    texture: 2048 * 1024 * 1024, // 2GB for textures
    buffer: 1024 * 1024 * 1024,  // 1GB for buffers
    geometry: 512 * 1024 * 1024, // 512MB for geometry
    shader: 64 * 1024 * 1024,    // 64MB for shaders
    image: 1024 * 1024 * 1024,   // 1GB for image data
  },
  allocationStrategy: 'best-fit',
  defragmentationEnabled: true,
  defragmentationThreshold: 0.3, // 30% fragmentation
  compressionEnabled: true,
  compressionThreshold: 0.8, // Compress when 80% full
  predictiveAllocation: true,
  memoryLeakDetection: true,
  optimizationStrategies: [],
};

export interface AdvancedMemoryManagerEvents {
  'memory-allocated': [MemoryAllocationResult, MemoryAllocationRequest];
  'memory-freed': [string, number]; // [blockId, size]
  'pool-created': [MemoryPool];
  'pool-defragmented': [string, number]; // [poolId, bytesReclaimed]
  'compression-applied': [string, number, number]; // [resourceId, originalSize, compressedSize]
  'leak-detected': [string, number]; // [viewportId, leakedBytes]
  'optimization-applied': [string, number]; // [strategyName, bytesFreed]
  'memory-pressure': [number, string]; // [pressureLevel 0-1, recommendation]
}

export class AdvancedMemoryManager extends EventEmitter {
  private config: AdvancedMemoryConfig;
  private memoryPools = new Map<string, MemoryPool>();
  private viewportProfiles = new Map<string, ViewportMemoryProfile>();
  private allocationHistory: MemoryAllocationRequest[] = [];
  private optimizationInterval: NodeJS.Timeout | null = null;
  private leakDetectionInterval: NodeJS.Timeout | null = null;
  private compressionWorker: Worker | null = null;

  // Performance tracking
  private allocationStats = {
    totalAllocations: 0,
    totalDeallocations: 0,
    totalBytesAllocated: 0,
    totalBytesFreed: 0,
    averageAllocationTime: 0,
    fragmentationEvents: 0,
    compressionEvents: 0,
  };

  constructor(config: Partial<AdvancedMemoryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_ADVANCED_MEMORY_CONFIG, ...config };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    log.info('AdvancedMemoryManager initializing', {
      component: 'AdvancedMemoryManager',
      metadata: {
        totalPoolSize: Object.values(this.config.poolSizes).reduce((a, b) => a + b, 0),
        strategy: this.config.allocationStrategy,
      },
    });

    // Initialize memory pools
    this.initializeMemoryPools();

    // Load built-in optimization strategies
    this.loadOptimizationStrategies();

    // Start optimization monitoring
    this.startOptimizationMonitoring();

    // Start memory leak detection
    if (this.config.memoryLeakDetection) {
      this.startLeakDetection();
    }

    // Initialize compression worker
    if (this.config.compressionEnabled) {
      await this.initializeCompressionWorker();
    }
  }

  // ===== Public API =====

  /**
   * Allocate memory for viewport resource
   */
  public async allocateMemory(request: MemoryAllocationRequest): Promise<MemoryAllocationResult> {
    const startTime = Date.now();

    try {
      // Track allocation request
      this.allocationHistory.push(request);
      if (this.allocationHistory.length > 1000) {
        this.allocationHistory.shift();
      }

      // Find suitable pool
      const pool = await this.findSuitablePool(request);
      if (!pool) {
        return {
          success: false,
          error: 'No suitable memory pool found',
          alternatives: await this.suggestAlternatives(request),
        };
      }

      // Allocate block
      const block = await this.allocateBlock(pool, request);
      if (!block) {
        // Try defragmentation
        if (this.config.defragmentationEnabled) {
          const reclaimedBytes = await this.defragmentPool(pool.id);
          if (reclaimedBytes > 0) {
            const retryBlock = await this.allocateBlock(pool, request);
            if (retryBlock) {
              return this.createAllocationResult(retryBlock, pool, startTime);
            }
          }
        }

        return {
          success: false,
          error: 'Insufficient memory in pool',
          alternatives: await this.suggestAlternatives(request),
        };
      }

      // Update viewport profile
      await this.updateViewportProfile(request.viewportId, block);

      // Track statistics
      this.updateAllocationStats(request, Date.now() - startTime);

      const result = this.createAllocationResult(block, pool, startTime);
      this.emit('memory-allocated', result, request);

      return result;

    } catch (error) {
      log.error('Memory allocation failed', {
        component: 'AdvancedMemoryManager',
        metadata: { request },
      }, error as Error);

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Free memory block
   */
  public async freeMemory(blockId: string): Promise<boolean> {
    try {
      const block = this.findBlock(blockId);
      if (!block) {
        log.warn('Attempted to free non-existent memory block', {
          component: 'AdvancedMemoryManager',
          metadata: { blockId },
        });
        return false;
      }

      const pool = this.memoryPools.get(block.poolId);
      if (!pool) {
        return false;
      }

      // Remove from allocated blocks
      const allocatedIndex = pool.allocatedBlocks.findIndex(b => b.id === blockId);
      if (allocatedIndex !== -1) {
        pool.allocatedBlocks.splice(allocatedIndex, 1);
      }

      // Add to free blocks
      block.isAllocated = false;
      block.viewportId = undefined;
      block.resourceId = undefined;
      pool.freeBlocks.push(block);
      pool.currentSize -= block.size;

      // Update viewport profile
      if (block.viewportId) {
        await this.updateViewportProfileAfterFree(block.viewportId, block);
      }

      // Merge adjacent free blocks
      await this.mergeFreeBlocks(pool);

      // Update statistics
      this.allocationStats.totalDeallocations++;
      this.allocationStats.totalBytesFreed += block.size;

      this.emit('memory-freed', blockId, block.size);

      log.info('Memory block freed', {
        component: 'AdvancedMemoryManager',
        metadata: { blockId, size: block.size, poolId: pool.id },
      });

      return true;

    } catch (error) {
      log.error('Failed to free memory block', {
        component: 'AdvancedMemoryManager',
        metadata: { blockId },
      }, error as Error);
      return false;
    }
  }

  /**
   * Optimize memory for viewport
   */
  public async optimizeViewportMemory(viewportId: string): Promise<number> {
    try {
      const profile = this.viewportProfiles.get(viewportId);
      if (!profile) {
        return 0;
      }

      let totalFreed = 0;

      // Apply compression if enabled
      if (this.config.compressionEnabled) {
        totalFreed += await this.compressViewportResources(viewportId);
      }

      // Clean up unused blocks
      totalFreed += await this.cleanupUnusedBlocks(viewportId);

      // Apply retention policy
      totalFreed += await this.applyRetentionPolicy(viewportId);

      // Update profile
      profile.lastOptimization = Date.now();

      log.info('Viewport memory optimized', {
        component: 'AdvancedMemoryManager',
        metadata: { viewportId, bytesFreed: totalFreed },
      });

      return totalFreed;

    } catch (error) {
      log.error('Failed to optimize viewport memory', {
        component: 'AdvancedMemoryManager',
        metadata: { viewportId },
      }, error as Error);
      return 0;
    }
  }

  /**
   * Get memory statistics
   */
  public getMemoryStatistics(): any {
    const poolStats = Array.from(this.memoryPools.values()).map(pool => ({
      id: pool.id,
      type: pool.type,
      maxSize: pool.maxSize,
      currentSize: pool.currentSize,
      utilizationRatio: pool.currentSize / pool.maxSize,
      fragmentationRatio: pool.fragmentationRatio,
      allocatedBlocks: pool.allocatedBlocks.length,
      freeBlocks: pool.freeBlocks.length,
    }));

    const viewportStats = Array.from(this.viewportProfiles.values()).map(profile => ({
      viewportId: profile.viewportId,
      allocatedMemory: profile.allocatedMemory,
      maxMemory: profile.maxMemory,
      utilizationRatio: profile.allocatedMemory / profile.maxMemory,
      compressionRatio: profile.compressionRatio,
      blockCount: profile.memoryBlocks.length,
    }));

    return {
      pools: poolStats,
      viewports: viewportStats,
      global: this.allocationStats,
      totalMemoryUsed: Array.from(this.memoryPools.values()).reduce((sum, pool) => sum + pool.currentSize, 0),
      totalMemoryAvailable: Array.from(this.memoryPools.values()).reduce((sum, pool) => sum + pool.maxSize, 0),
    };
  }

  /**
   * Defragment all memory pools
   */
  public async defragmentAllPools(): Promise<number> {
    let totalReclaimed = 0;

    for (const pool of this.memoryPools.values()) {
      if (pool.fragmentationRatio > this.config.defragmentationThreshold) {
        totalReclaimed += await this.defragmentPool(pool.id);
      }
    }

    return totalReclaimed;
  }

  // ===== Private Implementation =====

  private initializeMemoryPools(): void {
    Object.entries(this.config.poolSizes).forEach(([type, size]) => {
      const pool: MemoryPool = {
        id: `pool-${type}`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} Pool`,
        type: type as any,
        maxSize: size,
        currentSize: 0,
        allocatedBlocks: [],
        freeBlocks: [{
          id: `free-${type}-0`,
          poolId: `pool-${type}`,
          offset: 0,
          size,
          isAllocated: false,
          allocatedAt: 0,
          lastAccessed: 0,
          accessCount: 0,
          priority: 0,
        }],
        fragmentationRatio: 0,
        defragmentationThreshold: this.config.defragmentationThreshold,
      };

      this.memoryPools.set(pool.id, pool);
      this.emit('pool-created', pool);
    });

    log.info('Memory pools initialized', {
      component: 'AdvancedMemoryManager',
      metadata: { poolCount: this.memoryPools.size },
    });
  }

  private async findSuitablePool(request: MemoryAllocationRequest): Promise<MemoryPool | null> {
    const candidatePools = Array.from(this.memoryPools.values())
      .filter(pool => pool.type === request.type)
      .filter(pool => pool.maxSize - pool.currentSize >= request.size)
      .sort((a, b) => {
        // Prefer pools with less fragmentation
        if (this.config.allocationStrategy === 'best-fit') {
          return a.fragmentationRatio - b.fragmentationRatio;
        }
        return b.maxSize - a.maxSize; // Prefer larger pools
      });

    return candidatePools.length > 0 ? candidatePools[0] : null;
  }

  private async allocateBlock(pool: MemoryPool, request: MemoryAllocationRequest): Promise<MemoryBlock | null> {
    // Find suitable free block
    const suitableBlocks = pool.freeBlocks
      .filter(block => block.size >= request.size)
      .sort((a, b) => {
        switch (this.config.allocationStrategy) {
          case 'first-fit':
            return a.offset - b.offset;
          case 'best-fit':
            return a.size - b.size;
          case 'worst-fit':
            return b.size - a.size;
          default:
            return a.size - b.size;
        }
      });

    if (suitableBlocks.length === 0) {
      return null;
    }

    const freeBlock = suitableBlocks[0];
    const blockId = this.generateBlockId();

    // Create allocated block
    const allocatedBlock: MemoryBlock = {
      id: blockId,
      poolId: pool.id,
      offset: freeBlock.offset,
      size: request.size,
      isAllocated: true,
      viewportId: request.viewportId,
      resourceId: `resource-${blockId}`,
      allocatedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      priority: request.priority,
    };

    // Remove free block from pool
    const freeIndex = pool.freeBlocks.indexOf(freeBlock);
    pool.freeBlocks.splice(freeIndex, 1);

    // Add remaining free space if any
    if (freeBlock.size > request.size) {
      const remainingBlock: MemoryBlock = {
        ...freeBlock,
        id: this.generateBlockId(),
        offset: freeBlock.offset + request.size,
        size: freeBlock.size - request.size,
        isAllocated: false,
      };
      pool.freeBlocks.push(remainingBlock);
    }

    // Add to allocated blocks
    pool.allocatedBlocks.push(allocatedBlock);
    pool.currentSize += request.size;

    // Update fragmentation ratio
    this.updateFragmentationRatio(pool);

    return allocatedBlock;
  }

  private createAllocationResult(block: MemoryBlock, pool: MemoryPool, _startTime: number): MemoryAllocationResult {
    return {
      success: true,
      blockId: block.id,
      offset: block.offset,
      actualSize: block.size,
      poolId: pool.id,
    };
  }

  private async updateViewportProfile(viewportId: string, block: MemoryBlock): Promise<void> {
    let profile = this.viewportProfiles.get(viewportId);

    if (!profile) {
      profile = {
        viewportId,
        allocatedMemory: 0,
        maxMemory: 1024 * 1024 * 1024, // 1GB default
        memoryBlocks: [],
        memoryPools: [],
        retentionPolicy: {
          maxAge: 30 * 60 * 1000, // 30 minutes
          maxUnusedTime: 5 * 60 * 1000, // 5 minutes
          compressionEnabled: true,
          autoCleanup: true,
          priorityBoost: 1,
        },
        compressionRatio: 1.0,
        lastOptimization: Date.now(),
      };
      this.viewportProfiles.set(viewportId, profile);
    }

    profile.memoryBlocks.push(block);
    profile.allocatedMemory += block.size;

    if (!profile.memoryPools.includes(block.poolId)) {
      profile.memoryPools.push(block.poolId);
    }
  }

  private async updateViewportProfileAfterFree(viewportId: string, block: MemoryBlock): Promise<void> {
    const profile = this.viewportProfiles.get(viewportId);
    if (!profile) return;

    const blockIndex = profile.memoryBlocks.findIndex(b => b.id === block.id);
    if (blockIndex !== -1) {
      profile.memoryBlocks.splice(blockIndex, 1);
      profile.allocatedMemory -= block.size;
    }
  }

  private findBlock(blockId: string): MemoryBlock | null {
    for (const pool of this.memoryPools.values()) {
      const block = pool.allocatedBlocks.find(b => b.id === blockId);
      if (block) return block;
    }
    return null;
  }

  private async mergeFreeBlocks(pool: MemoryPool): Promise<void> {
    // Sort free blocks by offset
    pool.freeBlocks.sort((a, b) => a.offset - b.offset);

    // Merge adjacent blocks
    let i = 0;
    while (i < pool.freeBlocks.length - 1) {
      const currentBlock = pool.freeBlocks[i];
      const nextBlock = pool.freeBlocks[i + 1];

      if (currentBlock.offset + currentBlock.size === nextBlock.offset) {
        // Merge blocks
        currentBlock.size += nextBlock.size;
        pool.freeBlocks.splice(i + 1, 1);
      } else {
        i++;
      }
    }

    this.updateFragmentationRatio(pool);
  }

  private updateFragmentationRatio(pool: MemoryPool): void {
    const totalFreeSize = pool.freeBlocks.reduce((sum, block) => sum + block.size, 0);
    const freeBlockCount = pool.freeBlocks.length;

    if (totalFreeSize === 0 || freeBlockCount === 0) {
      pool.fragmentationRatio = 0;
    } else {
      // Simple fragmentation metric: more free blocks = more fragmentation
      pool.fragmentationRatio = Math.min(1, (freeBlockCount - 1) / 10);
    }
  }

  private async defragmentPool(poolId: string): Promise<number> {
    const pool = this.memoryPools.get(poolId);
    if (!pool) return 0;

    const beforeFragmentation = pool.fragmentationRatio;

    // Merge all free blocks
    await this.mergeFreeBlocks(pool);

    const afterFragmentation = pool.fragmentationRatio;
    const reclaimedFragmentation = beforeFragmentation - afterFragmentation;
    const reclaimedBytes = Math.floor(reclaimedFragmentation * pool.maxSize);

    this.allocationStats.fragmentationEvents++;
    this.emit('pool-defragmented', poolId, reclaimedBytes);

    log.info('Memory pool defragmented', {
      component: 'AdvancedMemoryManager',
      metadata: {
        poolId,
        beforeFragmentation,
        afterFragmentation,
        reclaimedBytes,
      },
    });

    return reclaimedBytes;
  }

  private async compressViewportResources(viewportId: string): Promise<number> {
    const profile = this.viewportProfiles.get(viewportId);
    if (!profile || !profile.retentionPolicy.compressionEnabled) {
      return 0;
    }

    let totalCompressed = 0;

    // Simulate compression of inactive resources
    const inactiveBlocks = profile.memoryBlocks.filter(
      block => Date.now() - block.lastAccessed > 60000, // 1 minute inactive
    );

    for (const block of inactiveBlocks) {
      const compressionRatio = 0.6; // Simulate 40% compression
      const originalSize = block.size;
      const compressedSize = Math.floor(originalSize * compressionRatio);
      const saved = originalSize - compressedSize;

      block.size = compressedSize;
      totalCompressed += saved;

      this.emit('compression-applied', block.resourceId || block.id, originalSize, compressedSize);
    }

    if (totalCompressed > 0) {
      profile.compressionRatio = profile.allocatedMemory / (profile.allocatedMemory + totalCompressed);
      this.allocationStats.compressionEvents++;
    }

    return totalCompressed;
  }

  private async cleanupUnusedBlocks(viewportId: string): Promise<number> {
    const profile = this.viewportProfiles.get(viewportId);
    if (!profile) return 0;

    const now = Date.now();
    const unusedThreshold = profile.retentionPolicy.maxUnusedTime;
    let totalFreed = 0;

    const blocksToFree = profile.memoryBlocks.filter(
      block => now - block.lastAccessed > unusedThreshold && block.accessCount < 2,
    );

    for (const block of blocksToFree) {
      if (await this.freeMemory(block.id)) {
        totalFreed += block.size;
      }
    }

    return totalFreed;
  }

  private async applyRetentionPolicy(viewportId: string): Promise<number> {
    const profile = this.viewportProfiles.get(viewportId);
    if (!profile || !profile.retentionPolicy.autoCleanup) {
      return 0;
    }

    const now = Date.now();
    const maxAge = profile.retentionPolicy.maxAge;
    let totalFreed = 0;

    const expiredBlocks = profile.memoryBlocks.filter(
      block => now - block.allocatedAt > maxAge,
    );

    for (const block of expiredBlocks) {
      if (await this.freeMemory(block.id)) {
        totalFreed += block.size;
      }
    }

    return totalFreed;
  }

  private async suggestAlternatives(request: MemoryAllocationRequest): Promise<MemoryAllocationResult[]> {
    const alternatives: MemoryAllocationResult[] = [];

    // Try smaller allocation
    if (request.size > 1024 * 1024) { // If > 1MB
      alternatives.push({
        success: false,
        error: 'Consider reducing allocation size',
        actualSize: Math.floor(request.size * 0.8),
      });
    }

    // Try different pool type
    const otherPools = Array.from(this.memoryPools.values()).filter(
      pool => pool.type !== request.type && pool.maxSize - pool.currentSize >= request.size,
    );

    otherPools.forEach(pool => {
      alternatives.push({
        success: false,
        error: `Consider using ${pool.type} pool instead`,
        poolId: pool.id,
      });
    });

    return alternatives;
  }

  private loadOptimizationStrategies(): void {
    const strategies: MemoryOptimizationStrategy[] = [
      {
        name: 'Aggressive Cleanup',
        description: 'Free all unused resources when memory pressure is high',
        threshold: 0.9,
        priority: 10,
        execute: async (manager, viewports) => {
          let totalFreed = 0;
          for (const viewport of viewports) {
            if (!viewport.activation.isActive) {
              totalFreed += await manager.optimizeViewportMemory(viewport.id);
            }
          }
          return totalFreed;
        },
      },
      {
        name: 'Compression Sweep',
        description: 'Apply compression to all inactive resources',
        threshold: 0.8,
        priority: 5,
        execute: async (manager, viewports) => {
          let totalFreed = 0;
          for (const viewport of viewports) {
            totalFreed += await manager.compressViewportResources(viewport.id);
          }
          return totalFreed;
        },
      },
      {
        name: 'Pool Defragmentation',
        description: 'Defragment all memory pools to reclaim space',
        threshold: 0.7,
        priority: 3,
        execute: async (manager) => {
          return await manager.defragmentAllPools();
        },
      },
    ];

    this.config.optimizationStrategies.push(...strategies);
  }

  private startOptimizationMonitoring(): void {
    this.optimizationInterval = setInterval(async () => {
      await this.checkMemoryPressure();
    }, 10000); // Check every 10 seconds
  }

  private async checkMemoryPressure(): Promise<void> {
    const stats = this.getMemoryStatistics();
    const globalUtilization = stats.totalMemoryUsed / stats.totalMemoryAvailable;

    if (globalUtilization > 0.9) {
      this.emit('memory-pressure', globalUtilization, 'Critical memory pressure - immediate cleanup required');
    } else if (globalUtilization > 0.8) {
      this.emit('memory-pressure', globalUtilization, 'High memory pressure - consider cleanup');
    }

    // Apply optimization strategies
    const applicableStrategies = this.config.optimizationStrategies
      .filter(strategy => globalUtilization >= strategy.threshold)
      .sort((a, b) => b.priority - a.priority);

    for (const strategy of applicableStrategies) {
      try {
        const bytesFreed = await strategy.execute(this, []);
        if (bytesFreed > 0) {
          this.emit('optimization-applied', strategy.name, bytesFreed);
          break; // Only apply one strategy per check
        }
      } catch (error) {
        log.error('Optimization strategy failed', {
          component: 'AdvancedMemoryManager',
          metadata: { strategyName: strategy.name },
        }, error as Error);
      }
    }
  }

  private startLeakDetection(): void {
    this.leakDetectionInterval = setInterval(() => {
      this.detectMemoryLeaks();
    }, 30000); // Check every 30 seconds
  }

  private detectMemoryLeaks(): void {
    this.viewportProfiles.forEach((profile, viewportId) => {
      const suspiciousBlocks = profile.memoryBlocks.filter(
        block => block.accessCount === 1 &&
                Date.now() - block.allocatedAt > 10 * 60 * 1000 && // > 10 minutes old
                Date.now() - block.lastAccessed > 5 * 60 * 1000,    // > 5 minutes unused
      );

      if (suspiciousBlocks.length > 0) {
        const leakedBytes = suspiciousBlocks.reduce((sum, block) => sum + block.size, 0);
        this.emit('leak-detected', viewportId, leakedBytes);

        log.warn('Potential memory leak detected', {
          component: 'AdvancedMemoryManager',
          metadata: {
            viewportId,
            suspiciousBlocks: suspiciousBlocks.length,
            leakedBytes,
          },
        });
      }
    });
  }

  private async initializeCompressionWorker(): Promise<void> {
    // In a real implementation, this would create a Web Worker for compression
    // For now, we'll mock it
    log.info('Compression worker initialized', {
      component: 'AdvancedMemoryManager',
    });
  }

  private updateAllocationStats(request: MemoryAllocationRequest, allocationTime: number): void {
    this.allocationStats.totalAllocations++;
    this.allocationStats.totalBytesAllocated += request.size;

    const prevAvg = this.allocationStats.averageAllocationTime;
    const count = this.allocationStats.totalAllocations;
    this.allocationStats.averageAllocationTime =
      (prevAvg * (count - 1) + allocationTime) / count;
  }

  private generateBlockId(): string {
    return `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // ===== Cleanup =====

  public dispose(): void {
    if (this.optimizationInterval) {
      clearInterval(this.optimizationInterval);
      this.optimizationInterval = null;
    }

    if (this.leakDetectionInterval) {
      clearInterval(this.leakDetectionInterval);
      this.leakDetectionInterval = null;
    }

    if (this.compressionWorker) {
      this.compressionWorker.terminate();
      this.compressionWorker = null;
    }

    this.memoryPools.clear();
    this.viewportProfiles.clear();
    this.allocationHistory = [];
    this.removeAllListeners();

    log.info('AdvancedMemoryManager disposed', {
      component: 'AdvancedMemoryManager',
    });
  }
}

// Singleton instance
export const advancedMemoryManager = new AdvancedMemoryManager();
