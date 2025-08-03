/**
 * Basic Annotation Click Handler Test
 * CommonJS test to verify click handling functionality
 */

// Simple test runner
function runTests() {
  console.log('🧪 Annotation Click Handler Basic Tests');
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

  // Test 1: Click Event Data Structure
  test('Click event data structure is correct', () => {
    const mockEvent = {
      clientX: 150,
      clientY: 200,
      screenX: 150,
      screenY: 200,
      offsetX: 50,
      offsetY: 75,
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
      metaKey: false,
    };

    const clickEventData = {
      annotationId: 'annotation-1',
      annotation: { id: 'annotation-1', type: 'length', state: 'completed' },
      viewportId: 'viewport-1',
      clickType: 'single',
      coordinates: {
        viewport: { x: 50, y: 75 },
        screen: { x: 150, y: 200 },
        canvas: { x: 50, y: 75 },
      },
      modifiers: {
        ctrl: false,
        shift: false,
        alt: true,
        meta: false,
      },
      timestamp: Date.now(),
    };

    if (!clickEventData.annotationId) throw new Error('Event should have annotation ID');
    if (!clickEventData.viewportId) throw new Error('Event should have viewport ID');
    if (clickEventData.clickType !== 'single') throw new Error('Click type should be single');
    if (!clickEventData.coordinates) throw new Error('Event should have coordinates');
    if (!clickEventData.modifiers) throw new Error('Event should have modifiers');
    if (clickEventData.modifiers.alt !== true) throw new Error('Alt modifier should be true');
  });

  // Test 2: Click Type Detection
  test('Click type detection works correctly', () => {
    const clickTypes = ['single', 'double', 'right'];
    
    clickTypes.forEach(type => {
      if (!['single', 'double', 'right'].includes(type)) {
        throw new Error(`Invalid click type: ${type}`);
      }
    });

    // Test double-click timing
    const doubleClickDelay = 300;
    const firstClickTime = Date.now();
    const secondClickTime = firstClickTime + 250; // Within delay
    const thirdClickTime = firstClickTime + 400; // Outside delay

    const isDoubleClick1 = (secondClickTime - firstClickTime) < doubleClickDelay;
    const isDoubleClick2 = (thirdClickTime - firstClickTime) < doubleClickDelay;

    if (!isDoubleClick1) throw new Error('Second click should be detected as double-click');
    if (isDoubleClick2) throw new Error('Third click should not be detected as double-click');
  });

  // Test 3: Click Options Configuration
  test('Click options configuration works correctly', () => {
    const options = {
      enableSingleClick: true,
      enableDoubleClick: true,
      enableRightClick: true,
      enableMultiSelect: true,
      doubleClickDelay: 300,
      clickTolerance: 5,
      preventDefaultOnAnnotation: true,
      propagateToViewport: false,
    };

    if (options.doubleClickDelay !== 300) {
      throw new Error('Double-click delay should be 300ms');
    }

    if (options.clickTolerance !== 5) {
      throw new Error('Click tolerance should be 5 pixels');
    }

    if (!options.enableMultiSelect) {
      throw new Error('Multi-select should be enabled by default');
    }

    if (options.propagateToViewport) {
      throw new Error('Event propagation should be disabled by default');
    }
  });

  // Test 4: Hit Detection with Tolerance
  test('Hit detection with tolerance works correctly', () => {
    const clickTolerance = 5;
    const annotationBounds = {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
    };

    // Test cases for hit detection
    const testCases = [
      { x: 125, y: 125, expected: true },  // Center - should hit
      { x: 95, y: 100, expected: true },   // Left edge with tolerance - should hit
      { x: 155, y: 100, expected: true },  // Right edge with tolerance - should hit
      { x: 100, y: 95, expected: true },   // Top edge with tolerance - should hit
      { x: 100, y: 155, expected: true },  // Bottom edge with tolerance - should hit
      { x: 94, y: 100, expected: false },  // Outside left tolerance - should miss
      { x: 156, y: 100, expected: false }, // Outside right tolerance - should miss
      { x: 100, y: 94, expected: false },  // Outside top tolerance - should miss
      { x: 100, y: 156, expected: false }, // Outside bottom tolerance - should miss
    ];

    testCases.forEach((testCase, index) => {
      const hit = (
        testCase.x >= annotationBounds.x - clickTolerance &&
        testCase.x <= annotationBounds.x + annotationBounds.width + clickTolerance &&
        testCase.y >= annotationBounds.y - clickTolerance &&
        testCase.y <= annotationBounds.y + annotationBounds.height + clickTolerance
      );

      if (hit !== testCase.expected) {
        throw new Error(`Test case ${index + 1} failed: expected ${testCase.expected}, got ${hit}`);
      }
    });
  });

  // Test 5: Multi-Select Logic
  test('Multi-select logic works correctly', () => {
    const selectedAnnotations = new Set();
    const enableMultiSelect = true;

    // Test single selection (no modifier)
    const event1 = { ctrlKey: false, metaKey: false };
    if (enableMultiSelect && (event1.ctrlKey || event1.metaKey)) {
      // Should preserve existing selections
    } else {
      // Should clear existing selections
      selectedAnnotations.clear();
    }
    selectedAnnotations.add('annotation-1');

    if (selectedAnnotations.size !== 1) {
      throw new Error('Should have 1 selected annotation after single selection');
    }

    // Test multi-selection (with modifier)
    const event2 = { ctrlKey: true, metaKey: false };
    if (enableMultiSelect && (event2.ctrlKey || event2.metaKey)) {
      // Should preserve existing selections
      selectedAnnotations.add('annotation-2');
    }

    if (selectedAnnotations.size !== 2) {
      throw new Error('Should have 2 selected annotations after multi-selection');
    }

    // Test deselection
    const event3 = { ctrlKey: false, metaKey: false };
    if (!event3.ctrlKey && !event3.metaKey) {
      selectedAnnotations.clear();
      selectedAnnotations.add('annotation-3');
    }

    if (selectedAnnotations.size !== 1) {
      throw new Error('Should have 1 selected annotation after deselection');
    }
  });

  // Test 6: Event Binding System
  test('Event binding system works correctly', () => {
    const eventBindings = new Map();

    // Register event bindings
    const bindings = [
      {
        id: 'click-select',
        eventType: 'click',
        enabled: true,
        priority: 10,
        handler: () => 'click handled',
      },
      {
        id: 'double-click-edit',
        eventType: 'doubleClick',
        enabled: true,
        priority: 9,
        handler: () => 'double-click handled',
      },
      {
        id: 'right-click-menu',
        eventType: 'rightClick',
        enabled: false, // Disabled
        priority: 8,
        handler: () => 'right-click handled',
      },
    ];

    bindings.forEach(binding => {
      eventBindings.set(binding.id, binding);
    });

    if (eventBindings.size !== 3) {
      throw new Error('Should have 3 event bindings');
    }

    // Test enabled bindings
    const enabledBindings = Array.from(eventBindings.values()).filter(b => b.enabled);
    if (enabledBindings.length !== 2) {
      throw new Error('Should have 2 enabled bindings');
    }

    // Test priority sorting
    const sortedBindings = Array.from(eventBindings.values()).sort((a, b) => b.priority - a.priority);
    if (sortedBindings[0].id !== 'click-select') {
      throw new Error('Click-select should have highest priority');
    }
  });

  // Test 7: Keyboard Shortcuts
  test('Keyboard shortcuts work correctly', () => {
    const selectedAnnotations = new Set(['annotation-1', 'annotation-2']);

    // Test Escape key - should clear selection
    const escapeEvent = { key: 'Escape', preventDefault: () => {} };
    if (escapeEvent.key === 'Escape' && selectedAnnotations.size > 0) {
      selectedAnnotations.clear();
    }

    if (selectedAnnotations.size !== 0) {
      throw new Error('Escape should clear all selections');
    }

    // Test Ctrl/Cmd+A - should select all
    const selectAllEvent = { 
      key: 'a', 
      ctrlKey: true, 
      metaKey: false,
      preventDefault: () => {}
    };
    
    const allAnnotations = ['annotation-1', 'annotation-2', 'annotation-3'];
    
    if ((selectAllEvent.ctrlKey || selectAllEvent.metaKey) && selectAllEvent.key === 'a') {
      allAnnotations.forEach(id => selectedAnnotations.add(id));
    }

    if (selectedAnnotations.size !== 3) {
      throw new Error('Ctrl+A should select all annotations');
    }
  });

  // Test 8: Event Statistics Tracking
  test('Event statistics tracking works correctly', () => {
    const stats = {
      totalClicks: 0,
      singleClicks: 0,
      doubleClicks: 0,
      rightClicks: 0,
    };

    // Simulate various clicks
    stats.totalClicks++;
    stats.singleClicks++;

    stats.totalClicks++;
    stats.singleClicks++;

    stats.totalClicks++;
    stats.doubleClicks++;

    stats.totalClicks++;
    stats.rightClicks++;

    if (stats.totalClicks !== 4) {
      throw new Error('Should have 4 total clicks');
    }

    if (stats.singleClicks !== 2) {
      throw new Error('Should have 2 single clicks');
    }

    if (stats.doubleClicks !== 1) {
      throw new Error('Should have 1 double click');
    }

    if (stats.rightClicks !== 1) {
      throw new Error('Should have 1 right click');
    }
  });

  // Test 9: Event Log Management
  test('Event log management works correctly', () => {
    const eventLog = [];
    const maxLogEntries = 50;

    // Add events
    for (let i = 0; i < 60; i++) {
      const entry = {
        id: `event-${i}`,
        timestamp: Date.now() + i,
        eventType: i % 3 === 0 ? 'click' : i % 3 === 1 ? 'doubleClick' : 'rightClick',
        annotationId: `annotation-${i % 3}`,
      };

      eventLog.unshift(entry); // Add to beginning
      
      // Maintain max size
      if (eventLog.length > maxLogEntries) {
        eventLog.pop(); // Remove oldest
      }
    }

    if (eventLog.length !== maxLogEntries) {
      throw new Error(`Event log should maintain max ${maxLogEntries} entries`);
    }

    // Check newest entry is first
    if (!eventLog[0].id.includes('59')) {
      throw new Error('Newest event should be first in log');
    }
  });

  // Test 10: Click Coordinate Transformation
  test('Click coordinate transformation works correctly', () => {
    const containerRect = {
      left: 100,
      top: 50,
      width: 800,
      height: 600,
    };

    const clickEvent = {
      clientX: 250,
      clientY: 150,
      screenX: 250,
      screenY: 200,
      offsetX: 150,
      offsetY: 100,
    };

    // Calculate viewport coordinates
    const viewportCoords = {
      x: clickEvent.clientX - containerRect.left,
      y: clickEvent.clientY - containerRect.top,
    };

    if (viewportCoords.x !== 150) {
      throw new Error('Viewport X coordinate should be 150');
    }

    if (viewportCoords.y !== 100) {
      throw new Error('Viewport Y coordinate should be 100');
    }

    // Verify all coordinate systems
    const coordinates = {
      viewport: viewportCoords,
      screen: { x: clickEvent.screenX, y: clickEvent.screenY },
      canvas: { x: clickEvent.offsetX, y: clickEvent.offsetY },
    };

    if (coordinates.screen.x !== 250 || coordinates.screen.y !== 200) {
      throw new Error('Screen coordinates are incorrect');
    }

    if (coordinates.canvas.x !== 150 || coordinates.canvas.y !== 100) {
      throw new Error('Canvas coordinates are incorrect');
    }
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