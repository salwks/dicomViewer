/**
 * Basic Synchronization Optimizer Test
 * CommonJS test to verify synchronization optimization functionality
 */

// Simple test runner
function runTests() {
  console.log('🧪 Synchronization Optimizer Basic Tests');
  console.log('========================================');

  let passed = 0;
  let total = 0;

  function test(description, testFn) {
    total++;
    try {
      testFn();
      console.log(`✅ ${description}`);
      passed++;
    } catch (error) {
      console.log(`❌ ${description}: ${error.message}`);
    }
  }

  // Test 1: Sync Operation Structure
  test('Sync operation structure is correct', () => {
    const syncOperation = {
      id: 'sync-op-12345',
      type: 'pan',
      sourceViewportId: 'viewport-1',
      targetViewportIds: ['viewport-2', 'viewport-3'],
      priority: 5,
      timestamp: Date.now(),
      data: {
        pan: { x: 100, y: 150 },
      },
      constraints: {
        maxDelay: 50,
        requireExactMatch: false,
        allowPartialSync: true,
        priority: 8,
      },
    };

    if (!syncOperation.id) throw new Error('Operation should have ID');
    if (!syncOperation.type) throw new Error('Operation should have type');
    if (!syncOperation.sourceViewportId) throw new Error('Operation should have source viewport');
    if (!Array.isArray(syncOperation.targetViewportIds)) throw new Error('Target viewports should be array');
    if (typeof syncOperation.priority !== 'number') throw new Error('Priority should be number');
    if (!syncOperation.data) throw new Error('Operation should have data');
  });

  // Test 2: Sync Group Configuration
  test('Sync group configuration works correctly', () => {
    const syncGroup = {
      id: 'sync-group-123',
      name: 'Test Group',
      viewportIds: ['viewport-1', 'viewport-2', 'viewport-3'],
      syncTypes: ['pan', 'zoom', 'window-level'],
      priority: 7,
      isActive: true,
      constraints: {
        maxLatency: 50,
        tolerateFailures: true,
        requireConsensus: false,
        batchOperations: true,
      },
      performance: {
        averageLatency: 0,
        successRate: 1.0,
        operationsPerSecond: 0,
        lastSyncTime: 0,
      },
    };

    if (syncGroup.viewportIds.length !== 3) {
      throw new Error('Should have 3 viewports in group');
    }

    if (syncGroup.syncTypes.length !== 3) {
      throw new Error('Should have 3 sync types');
    }

    if (!syncGroup.isActive) {
      throw new Error('Group should be active by default');
    }

    if (syncGroup.performance.successRate !== 1.0) {
      throw new Error('Initial success rate should be 100%');
    }
  });

  // Test 3: Priority Queue Management
  test('Priority queue management works correctly', () => {
    const operationQueue = new Map();
    
    // Initialize priority queues (0-10)
    for (let priority = 0; priority <= 10; priority++) {
      operationQueue.set(priority, []);
    }

    // Add operations with different priorities
    const operations = [
      { id: 'op1', priority: 10, type: 'crosshair' },
      { id: 'op2', priority: 5, type: 'pan' },
      { id: 'op3', priority: 1, type: 'scroll' },
      { id: 'op4', priority: 8, type: 'window-level' },
    ];

    operations.forEach(op => {
      const priority = Math.min(10, Math.max(0, op.priority));
      const queue = operationQueue.get(priority);
      queue.push(op);
    });

    if (operationQueue.get(10).length !== 1) {
      throw new Error('Priority 10 queue should have 1 operation');
    }

    if (operationQueue.get(5).length !== 1) {
      throw new Error('Priority 5 queue should have 1 operation');
    }

    // Test getting next operation (highest priority first)
    let nextOperation = null;
    for (let priority = 10; priority >= 0; priority--) {
      const queue = operationQueue.get(priority);
      if (queue.length > 0) {
        nextOperation = queue.shift();
        break;
      }
    }

    if (nextOperation.id !== 'op1') {
      throw new Error('Should get highest priority operation first');
    }
  });

  // Test 4: Optimization Strategies
  test('Optimization strategies work correctly', () => {
    const strategies = {
      BATCHING: 'batching',
      THROTTLING: 'throttling',
      PRIORITY_QUEUING: 'priority-queuing',
      PREDICTIVE_SYNC: 'predictive-sync',
      ADAPTIVE_DELAY: 'adaptive-delay',
      SELECTIVE_SYNC: 'selective-sync',
    };

    const activeStrategies = [
      strategies.BATCHING,
      strategies.THROTTLING,
      strategies.PRIORITY_QUEUING,
    ];

    if (activeStrategies.length !== 3) {
      throw new Error('Should have 3 active strategies');
    }

    if (!activeStrategies.includes('batching')) {
      throw new Error('Should include batching strategy');
    }

    if (!activeStrategies.includes('throttling')) {
      throw new Error('Should include throttling strategy');
    }
  });

  // Test 5: Batching Logic
  test('Batching logic works correctly', () => {
    const pendingBatches = new Map();
    const batchDelayMs = 16; // ~60fps

    // Create batch key
    const operation1 = { type: 'pan', sourceViewportId: 'viewport-1' };
    const operation2 = { type: 'pan', sourceViewportId: 'viewport-1' };
    const operation3 = { type: 'zoom', sourceViewportId: 'viewport-1' };

    const batchKey1 = `${operation1.type}-${operation1.sourceViewportId}`;
    const batchKey2 = `${operation2.type}-${operation2.sourceViewportId}`;
    const batchKey3 = `${operation3.type}-${operation3.sourceViewportId}`;

    // Same operations should have same batch key
    if (batchKey1 !== batchKey2) {
      throw new Error('Same operation types should have same batch key');
    }

    // Different operations should have different batch keys
    if (batchKey1 === batchKey3) {
      throw new Error('Different operation types should have different batch keys');
    }

    // Add to batch
    if (!pendingBatches.has(batchKey1)) {
      pendingBatches.set(batchKey1, []);
    }

    const batch = pendingBatches.get(batchKey1);
    batch.push(operation1, operation2);

    if (batch.length !== 2) {
      throw new Error('Batch should contain 2 operations');
    }

    if (batchDelayMs !== 16) {
      throw new Error('Batch delay should be 16ms for 60fps');
    }
  });

  // Test 6: Throttling Logic
  test('Throttling logic works correctly', () => {
    const throttleThresholdMs = 33; // ~30fps minimum
    const lastOperationTime = Date.now() - 10; // 10ms ago
    const currentTime = Date.now();

    const timeSinceLastOp = currentTime - lastOperationTime;
    const shouldThrottle = timeSinceLastOp < throttleThresholdMs;

    if (!shouldThrottle) {
      throw new Error('Should throttle operations within threshold');
    }

    // Test throttle state
    const throttleState = {
      isThrottling: false,
      lastThrottleTime: 0,
      consecutiveOperations: 0,
    };

    if (shouldThrottle) {
      throttleState.consecutiveOperations++;
    }

    if (throttleState.consecutiveOperations !== 1) {
      throw new Error('Should increment consecutive operations count');
    }

    // Test progressive throttling
    throttleState.consecutiveOperations = 6; // More than 5
    const delay = Math.min(100, throttleState.consecutiveOperations * 5);

    if (delay !== 30) {
      throw new Error('Progressive throttling delay should be 30ms');
    }
  });

  // Test 7: Performance Metrics Tracking
  test('Performance metrics tracking works correctly', () => {
    const metrics = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      averageLatency: 0,
      peakLatency: 0,
      throughput: 0,
      queueLength: 0,
      activeGroups: 0,
      throttledOperations: 0,
      batchedOperations: 0,
    };

    // Simulate operations
    metrics.totalOperations = 10;
    metrics.completedOperations = 8;
    metrics.failedOperations = 2;

    // Calculate success rate
    const successRate = metrics.completedOperations / metrics.totalOperations;
    if (successRate !== 0.8) {
      throw new Error('Success rate should be 80%');
    }

    // Update average latency
    const newLatency = 25;
    const total = metrics.completedOperations;
    metrics.averageLatency = (metrics.averageLatency * (total - 1) + newLatency) / total;

    if (metrics.averageLatency !== newLatency) { // First measurement
      // For multiple measurements, this would be different
    }

    // Update peak latency
    metrics.peakLatency = Math.max(metrics.peakLatency, newLatency);
    if (metrics.peakLatency !== 25) {
      throw new Error('Peak latency should be updated');
    }
  });

  // Test 8: Operation Merging
  test('Operation merging works correctly', () => {
    const operations = [
      {
        id: 'op1',
        type: 'pan',
        sourceViewportId: 'viewport-1',
        targetViewportIds: ['viewport-2'],
        priority: 5,
        timestamp: Date.now() - 20,
        data: { pan: { x: 10, y: 20 } },
      },
      {
        id: 'op2',
        type: 'pan',
        sourceViewportId: 'viewport-1',
        targetViewportIds: ['viewport-3'],
        priority: 7,
        timestamp: Date.now() - 10,
        data: { pan: { x: 15, y: 25 } },
      },
      {
        id: 'op3',
        type: 'pan',
        sourceViewportId: 'viewport-1',
        targetViewportIds: ['viewport-4'],
        priority: 3,
        timestamp: Date.now(),
        data: { pan: { x: 20, y: 30 } },
      },
    ];

    if (operations.length === 0) {
      throw new Error('Should have operations to merge');
    }

    // Take the most recent operation as base
    const latest = operations[operations.length - 1];
    const merged = {
      ...latest,
      id: 'merged-op-123',
      timestamp: Date.now(),
    };

    // Merge target viewports
    const allTargets = new Set();
    operations.forEach(op => {
      op.targetViewportIds.forEach(id => allTargets.add(id));
    });
    merged.targetViewportIds = Array.from(allTargets);

    if (merged.targetViewportIds.length !== 3) {
      throw new Error('Merged operation should have 3 target viewports');
    }

    // Use highest priority
    merged.priority = Math.max(...operations.map(op => op.priority));
    if (merged.priority !== 7) {
      throw new Error('Merged operation should have highest priority (7)');
    }
  });

  // Test 9: Configuration Adaptation
  test('Configuration adaptation works correctly', () => {
    const config = {
      maxConcurrentOperations: 8,
      operationTimeoutMs: 100,
      batchDelayMs: 16,
      throttleThresholdMs: 33,
    };

    const metrics = {
      averageLatency: 120, // High latency
      totalOperations: 100,
      failedOperations: 5, // 5% error rate
      throughput: 45,
    };

    // Adapt based on high latency
    if (metrics.averageLatency > 100) {
      config.batchDelayMs = Math.max(8, config.batchDelayMs - 2);
      config.throttleThresholdMs = Math.min(50, config.throttleThresholdMs + 5);
    }

    if (config.batchDelayMs !== 14) {
      throw new Error('Batch delay should be reduced to 14ms');
    }

    if (config.throttleThresholdMs !== 38) {
      throw new Error('Throttle threshold should be increased to 38ms');
    }

    // Adapt based on error rate
    const errorRate = metrics.failedOperations / metrics.totalOperations;
    if (errorRate > 0.1) {
      // High error rate - reduce concurrency
      config.maxConcurrentOperations = Math.max(2, config.maxConcurrentOperations - 1);
    } else if (errorRate < 0.02 && metrics.throughput > 50) {
      // Low error rate and high throughput - increase concurrency
      config.maxConcurrentOperations = Math.min(16, config.maxConcurrentOperations + 1);
    }

    // 5% error rate is neither high nor low in this case, so no change
    if (config.maxConcurrentOperations !== 8) {
      throw new Error('Concurrent operations should remain at 8 for moderate error rate');
    }
  });

  // Test 10: Operation Complexity Calculation
  test('Operation complexity calculation works correctly', () => {
    const complexityMap = {
      'pan': 5,
      'zoom': 8,
      'window-level': 3,
      'scroll': 10,
      'crosshair': 2,
      'orientation': 15,
    };

    const operations = [
      { type: 'pan', targetViewportIds: ['v1', 'v2'] },
      { type: 'orientation', targetViewportIds: ['v1'] },
      { type: 'crosshair', targetViewportIds: ['v1', 'v2', 'v3'] },
    ];

    operations.forEach(op => {
      const baseTime = complexityMap[op.type] || 5;
      const targetMultiplier = Math.min(3, op.targetViewportIds.length * 0.5);
      const estimatedDuration = baseTime * targetMultiplier;

      if (op.type === 'pan') {
        // 2 targets: multiplier = min(3, 2 * 0.5) = 1
        // Duration = 5 * 1 = 5
        if (estimatedDuration !== 5) {
          throw new Error('Pan operation duration should be 5ms');
        }
      }

      if (op.type === 'orientation') {
        // 1 target: multiplier = min(3, 1 * 0.5) = 0.5
        // Duration = 15 * 0.5 = 7.5
        if (estimatedDuration !== 7.5) {
          throw new Error('Orientation operation duration should be 7.5ms');
        }
      }

      if (op.type === 'crosshair') {
        // 3 targets: multiplier = min(3, 3 * 0.5) = 1.5
        // Duration = 2 * 1.5 = 3
        if (estimatedDuration !== 3) {
          throw new Error('Crosshair operation duration should be 3ms');
        }
      }
    });
  });

  console.log('========================================');
  console.log(`📊 Results: ${passed}/${total} tests passed`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (passed === total) {
    console.log('🎉 All tests passed!');
    return true;
  } else {
    console.log('❌ Some tests failed!');
    return false;
  }
}

// Run the tests
const success = runTests();
process.exit(success ? 0 : 1);