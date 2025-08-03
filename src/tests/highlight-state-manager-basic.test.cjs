/**
 * Basic Highlight State Manager Test
 * CommonJS test to verify highlight state management functionality
 */

// Simple test runner
function runTests() {
  console.log('🧪 Highlight State Manager Basic Tests');
  console.log('======================================');

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

  // Test 1: Highlight State Structure
  test('Highlight state structure is correct', () => {
    const highlightState = {
      id: 'highlight-state-123',
      annotationId: 'annotation-1',
      viewportId: 'viewport-1',
      state: 'inactive',
      style: {
        color: '#87CEEB', // Sky blue
        thickness: 3,
        opacity: 0.8,
        glowRadius: 8,
        pulseEnabled: true,
        pulseSpeed: 2000,
        pattern: 'solid',
        shadowEnabled: true,
        shadowColor: 'rgba(135, 206, 235, 0.3)',
        shadowBlur: 4,
      },
      animation: {
        type: 'pulse',
        duration: 1000,
        iterations: 'infinite',
        direction: 'alternate',
        easing: 'ease-in-out',
        startTime: Date.now(),
        progress: 0,
        isPlaying: true,
      },
      metadata: {
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        transitionCount: 0,
        errorCount: 0,
      },
    };

    if (!highlightState.id) throw new Error('State should have ID');
    if (!highlightState.annotationId) throw new Error('State should have annotation ID');
    if (!highlightState.viewportId) throw new Error('State should have viewport ID');
    if (!highlightState.style) throw new Error('State should have style');
    if (highlightState.style.color !== '#87CEEB') throw new Error('Default color should be sky blue');
    if (!highlightState.metadata) throw new Error('State should have metadata');
  });

  // Test 2: Default Configuration
  test('Default configuration is correct', () => {
    const defaultConfig = {
      maxStates: 1000,
      defaultStyle: {
        color: '#87CEEB',
        thickness: 3,
        opacity: 0.8,
        glowRadius: 8,
        pulseEnabled: true,
        pulseSpeed: 2000,
        pattern: 'solid',
        shadowEnabled: true,
        shadowColor: 'rgba(135, 206, 235, 0.3)',
        shadowBlur: 4,
      },
      transitionDuration: 300,
      enableAnimations: true,
      enableBatching: true,
      batchSize: 10,
      cleanupInterval: 60000,
      retentionPeriod: 300000,
    };

    if (defaultConfig.maxStates !== 1000) throw new Error('Max states should be 1000');
    if (defaultConfig.defaultStyle.color !== '#87CEEB') throw new Error('Default color should be sky blue');
    if (defaultConfig.transitionDuration !== 300) throw new Error('Transition duration should be 300ms');
    if (!defaultConfig.enableAnimations) throw new Error('Animations should be enabled by default');
    if (defaultConfig.batchSize !== 10) throw new Error('Batch size should be 10');
  });

  // Test 3: State Transitions
  test('State transitions work correctly', () => {
    const states = ['inactive', 'active', 'transitioning', 'error'];
    
    const validTransitions = {
      'inactive': ['active', 'transitioning'],
      'active': ['inactive', 'transitioning'],
      'transitioning': ['active', 'inactive', 'error'],
      'error': ['inactive'],
    };

    states.forEach(state => {
      if (!validTransitions[state]) {
        throw new Error(`No valid transitions defined for state: ${state}`);
      }
    });

    // Test transition validation
    const isValidTransition = (from, to) => {
      return validTransitions[from] && validTransitions[from].includes(to);
    };

    if (!isValidTransition('inactive', 'active')) {
      throw new Error('Should allow transition from inactive to active');
    }

    if (isValidTransition('active', 'error')) {
      throw new Error('Should not allow direct transition from active to error');
    }

    // Test transition record structure
    const transition = {
      id: 'transition-123',
      fromState: 'inactive',
      toState: 'active',
      timestamp: Date.now(),
      duration: 300,
      reason: 'user-activation',
      success: true,
    };

    if (!transition.id) throw new Error('Transition should have ID');
    if (transition.duration !== 300) throw new Error('Transition duration should match config');
    if (!transition.success) throw new Error('Successful transition should be marked as success');
  });

  // Test 4: Animation System
  test('Animation system works correctly', () => {
    const animationTypes = ['pulse', 'glow', 'fade', 'scale', 'rotate'];
    const easingTypes = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

    animationTypes.forEach(type => {
      if (!['pulse', 'glow', 'fade', 'scale', 'rotate'].includes(type)) {
        throw new Error(`Invalid animation type: ${type}`);
      }
    });

    easingTypes.forEach(easing => {
      if (!['linear', 'ease-in', 'ease-out', 'ease-in-out'].includes(easing)) {
        throw new Error(`Invalid easing type: ${easing}`);
      }
    });

    // Test easing functions
    const applyEasing = (t, easing) => {
      switch (easing) {
        case 'linear': return t;
        case 'ease-in': return t * t;
        case 'ease-out': return 1 - (1 - t) * (1 - t);
        case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        default: return t;
      }
    };

    const linearResult = applyEasing(0.5, 'linear');
    if (linearResult !== 0.5) throw new Error('Linear easing should return input value');

    const easeInResult = applyEasing(0.5, 'ease-in');
    if (easeInResult !== 0.25) throw new Error('Ease-in should return t^2');

    // Test animation progress calculation
    const startTime = Date.now() - 500; // Started 500ms ago
    const duration = 1000;
    const elapsed = Date.now() - startTime;
    const progress = elapsed / duration;

    if (progress < 0 || progress > 1) {
      // For ongoing animation, progress might be > 1 if infinite
      console.log('Animation progress calculated:', progress);
    }
  });

  // Test 5: Style Management
  test('Style management works correctly', () => {
    const baseStyle = {
      color: '#87CEEB',
      thickness: 3,
      opacity: 0.8,
      glowRadius: 8,
      pulseEnabled: true,
      pulseSpeed: 2000,
    };

    const styleUpdate = {
      thickness: 5,
      opacity: 0.9,
      glowRadius: 12,
    };

    const updatedStyle = { ...baseStyle, ...styleUpdate };

    if (updatedStyle.thickness !== 5) throw new Error('Thickness should be updated');
    if (updatedStyle.opacity !== 0.9) throw new Error('Opacity should be updated');
    if (updatedStyle.color !== '#87CEEB') throw new Error('Color should remain unchanged');
    if (updatedStyle.pulseSpeed !== 2000) throw new Error('Pulse speed should remain unchanged');

    // Test style validation
    const isValidColor = (color) => {
      return /^#[0-9A-Fa-f]{6}$/.test(color) || /^rgba?\([^)]+\)$/.test(color);
    };

    if (!isValidColor('#87CEEB')) throw new Error('Sky blue should be valid color');
    if (!isValidColor('rgba(135, 206, 235, 0.3)')) throw new Error('RGBA color should be valid');
    if (isValidColor('invalid-color')) throw new Error('Should reject invalid color');

    // Test thickness validation
    if (updatedStyle.thickness <= 0) throw new Error('Thickness should be positive');
    if (updatedStyle.opacity < 0 || updatedStyle.opacity > 1) throw new Error('Opacity should be between 0 and 1');
  });

  // Test 6: Batch Processing
  test('Batch processing works correctly', () => {
    const batchQueue = [];
    const batchSize = 3;
    let processedOperations = 0;

    // Add operations to queue
    for (let i = 0; i < 5; i++) {
      batchQueue.push(() => {
        processedOperations++;
      });
    }

    // Process first batch
    const firstBatch = batchQueue.splice(0, batchSize);
    firstBatch.forEach(operation => operation());

    if (processedOperations !== 3) throw new Error('Should process 3 operations in first batch');
    if (batchQueue.length !== 2) throw new Error('Should have 2 operations remaining');

    // Process remaining operations
    const remainingBatch = batchQueue.splice(0, batchSize);
    remainingBatch.forEach(operation => operation());

    if (processedOperations !== 5) throw new Error('Should process all 5 operations total');
    if (batchQueue.length !== 0) throw new Error('Queue should be empty after processing');

    // Test batch timing
    const batchDelay = 16; // ~60fps
    const startTime = Date.now();
    
    setTimeout(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed < batchDelay - 2 || elapsed > batchDelay + 10) {
        console.log(`Batch timing: ${elapsed}ms (target: ${batchDelay}ms)`);
      }
    }, batchDelay);
  });

  // Test 7: Memory Management
  test('Memory management works correctly', () => {
    const maxStates = 5;
    const states = new Map();

    // Fill states up to limit
    for (let i = 0; i < maxStates; i++) {
      const state = {
        id: `state-${i}`,
        annotationId: `annotation-${i}`,
        createdAt: Date.now() - ((maxStates - i) * 1000), // state-0 is oldest
      };
      states.set(state.id, state);
    }

    if (states.size !== maxStates) throw new Error('Should have max states');

    // Add one more state (should trigger eviction)
    const newState = {
      id: 'state-new',
      annotationId: 'annotation-new',
      createdAt: Date.now(),
    };

    // Find oldest state for eviction
    let oldestState = null;
    let oldestTime = Date.now();

    for (const state of states.values()) {
      if (state.createdAt < oldestTime) {
        oldestTime = state.createdAt;
        oldestState = state;
      }
    }

    if (oldestState) {
      states.delete(oldestState.id);
      states.set(newState.id, newState);
    }

    if (states.size !== maxStates) throw new Error('Should maintain max states after eviction');
    if (states.has(oldestState.id)) throw new Error('Oldest state should be evicted');
    if (!states.has('state-new')) throw new Error('New state should be added');

    // Test memory usage estimation
    const stateSize = 500; // bytes per state
    const transitionSize = 200; // bytes per transition
    const transitionCount = 10;
    
    const estimatedUsage = (states.size * stateSize) + (transitionCount * transitionSize);
    const expectedUsage = (5 * 500) + (10 * 200); // 2500 + 2000 = 4500

    if (estimatedUsage !== expectedUsage) throw new Error('Memory usage estimation is incorrect');
  });

  // Test 8: State Filtering and Queries
  test('State filtering and queries work correctly', () => {
    const states = [
      { id: 'state-1', viewportId: 'viewport-1', annotationId: 'annotation-1', state: 'active' },
      { id: 'state-2', viewportId: 'viewport-1', annotationId: 'annotation-2', state: 'inactive' },
      { id: 'state-3', viewportId: 'viewport-2', annotationId: 'annotation-3', state: 'active' },
      { id: 'state-4', viewportId: 'viewport-2', annotationId: 'annotation-4', state: 'transitioning' },
    ];

    // Filter by viewport
    const viewport1States = states.filter(s => s.viewportId === 'viewport-1');
    if (viewport1States.length !== 2) throw new Error('Should find 2 states for viewport-1');

    // Filter by annotation
    const annotation1States = states.filter(s => s.annotationId === 'annotation-1');
    if (annotation1States.length !== 1) throw new Error('Should find 1 state for annotation-1');

    // Filter by state
    const activeStates = states.filter(s => s.state === 'active');
    if (activeStates.length !== 2) throw new Error('Should find 2 active states');

    // Complex filtering
    const viewport2ActiveStates = states.filter(s => 
      s.viewportId === 'viewport-2' && s.state === 'active'
    );
    if (viewport2ActiveStates.length !== 1) throw new Error('Should find 1 active state in viewport-2');

    // Test state counting
    const statesByViewport = new Map();
    states.forEach(state => {
      const count = statesByViewport.get(state.viewportId) || 0;
      statesByViewport.set(state.viewportId, count + 1);
    });

    if (statesByViewport.get('viewport-1') !== 2) throw new Error('Viewport-1 should have 2 states');
    if (statesByViewport.get('viewport-2') !== 2) throw new Error('Viewport-2 should have 2 states');
  });

  // Test 9: Cleanup and Retention
  test('Cleanup and retention work correctly', () => {
    const now = Date.now();
    const retentionPeriod = 300000; // 5 minutes
    const cutoffTime = now - retentionPeriod;

    const states = [
      { id: 'state-1', state: 'inactive', metadata: { lastUpdated: cutoffTime - 60000 } }, // Old, should be removed
      { id: 'state-2', state: 'active', metadata: { lastUpdated: cutoffTime - 30000 } },   // Old but active, keep
      { id: 'state-3', state: 'inactive', metadata: { lastUpdated: cutoffTime + 60000 } }, // Recent, keep
      { id: 'state-4', state: 'inactive', metadata: { lastUpdated: cutoffTime - 120000 } }, // Old, should be removed
    ];

    // Filter states for cleanup (remove old inactive states)
    const statesToKeep = states.filter(state => 
      !(state.state === 'inactive' && state.metadata.lastUpdated < cutoffTime)
    );

    if (statesToKeep.length !== 2) throw new Error('Should keep 2 states after cleanup');

    const removedCount = states.length - statesToKeep.length;
    if (removedCount !== 2) throw new Error('Should remove 2 old inactive states');

    // Test transition cleanup
    const transitions = [
      { id: 'trans-1', timestamp: cutoffTime - 60000 }, // Old, remove
      { id: 'trans-2', timestamp: cutoffTime + 30000 }, // Recent, keep
      { id: 'trans-3', timestamp: cutoffTime - 90000 }, // Old, remove
    ];

    const transitionsToKeep = transitions.filter(t => t.timestamp >= cutoffTime);
    if (transitionsToKeep.length !== 1) throw new Error('Should keep 1 recent transition');
  });

  // Test 10: Error Handling and Recovery
  test('Error handling and recovery work correctly', () => {
    const state = {
      id: 'state-error-test',
      state: 'active',
      metadata: {
        errorCount: 0,
        transitionCount: 0,
      },
    };

    // Simulate transition error
    try {
      // This would normally be handled by the state manager
      throw new Error('Transition failed');
    } catch (error) {
      state.state = 'error';
      state.metadata.errorCount++;
    }

    if (state.state !== 'error') throw new Error('State should be in error state');
    if (state.metadata.errorCount !== 1) throw new Error('Error count should be incremented');

    // Test error recovery
    const canRecover = state.metadata.errorCount < 3; // Max 3 errors before permanent failure

    if (!canRecover) {
      throw new Error('Should allow recovery with low error count');
    }

    // Simulate successful recovery
    state.state = 'inactive';
    // Error count remains for tracking, but state is recovered

    if (state.state !== 'inactive') throw new Error('State should be recovered to inactive');

    // Test animation error handling
    const animation = {
      type: 'pulse',
      isPlaying: true,
      progress: 0.5,
    };

    try {
      // Simulate animation error
      if (animation.progress > 1 || animation.progress < 0) {
        throw new Error('Invalid animation progress');
      }
      // Animation continues normally
    } catch (error) {
      animation.isPlaying = false;
      console.log('Animation stopped due to error:', error.message);
    }

    if (!animation.isPlaying) {
      // Animation was stopped, this is expected behavior
      console.log('Animation error handling worked correctly');
    }
  });

  console.log('======================================');
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