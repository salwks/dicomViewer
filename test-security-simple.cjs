#!/usr/bin/env node

/**
 * Security Functions Test Suite
 * Simple JavaScript version testing core security patterns
 */

// Implement core security functions for testing
function safeObjectAccess(obj, key, defaultValue) {
  // Validate key is a safe string
  if (typeof key !== 'string' || key.length === 0) {
    return defaultValue;
  }

  // Whitelist approach for DICOM tag keys
  if (key.startsWith('x') && key.length === 9) {
    // DICOM tag format: x00080016
    const tagPattern = /^x[0-9a-fA-F]{8}$/;
    if (tagPattern.test(key)) {
      return obj[key] !== undefined ? obj[key] : defaultValue;
    }
  }

  // Safe property names for DICOM metadata
  const safeProperties = new Set([
    'StudyInstanceUID',
    'SeriesInstanceUID', 
    'SOPInstanceUID',
    'PatientName',
    'PatientID',
    'StudyDate',
    'StudyTime',
    'Modality',
    'SeriesNumber',
    'InstanceNumber',
    'ImageType',
    'SOPClassUID',
    'TransferSyntaxUID',
    'Rows',
    'Columns',
    'BitsAllocated',
    'BitsStored',
    'HighBit',
    'PixelRepresentation',
    'PhotometricInterpretation',
    'SamplesPerPixel',
    'PlanarConfiguration',
    'PixelSpacing',
    'SliceThickness',
    'SpacingBetweenSlices',
    'ImageOrientationPatient',
    'ImagePositionPatient',
    'WindowCenter',
    'WindowWidth',
    'RescaleIntercept',
    'RescaleSlope',
    'SeriesDescription',
    'NumberOfFrames',
    'imageId',
    'volumeId',
    'viewportId',
    'toolName',
    'name',
    'value',
    'type',
    'category',
    'enabled',
    'priority',
    'status',
  ]);

  if (safeProperties.has(key)) {
    return obj[key] !== undefined ? obj[key] : defaultValue;
  }

  return defaultValue;
}

function safeArrayAccess(arr, index, defaultValue) {
  if (!Array.isArray(arr) || typeof index !== 'number' || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] !== undefined ? arr[index] : defaultValue;
}

function createSafeObject(source, allowedKeys) {
  const safeObj = {};

  for (const key of allowedKeys) {
    if (typeof key === 'string' && key.length > 0 && Object.prototype.hasOwnProperty.call(source, key)) {
      const value = safeObjectAccess(source, key);
      if (value !== undefined) {
        safeObj[key] = value;
      }
    }
  }

  return safeObj;
}

function isValidDICOMTag(tag) {
  if (typeof tag !== 'string') return false;

  // Format: x00080016 (8 hex digits after x)
  const tagPattern = /^x[0-9a-fA-F]{8}$/;
  return tagPattern.test(tag);
}

function getSafeKeys(obj) {
  const keys = Object.keys(obj);
  return keys.filter(key =>
    typeof key === 'string' &&
    key !== '__proto__' &&
    key !== 'constructor' &&
    key !== 'prototype' &&
    !key.startsWith('_'),
  );
}

// Test utilities
let testCount = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  testCount++;
  if (condition) {
    console.log(`✅ Test ${testCount}: ${message}`);
    passedTests++;
  } else {
    console.log(`❌ Test ${testCount}: ${message}`);
    failedTests++;
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

function assertUndefined(actual, message) {
  assert(actual === undefined, `${message} (expected: undefined, got: ${actual})`);
}

function printTestSummary() {
  console.log('\n=== Test Summary ===');
  console.log(`Total tests: ${testCount}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`Success rate: ${((passedTests / testCount) * 100).toFixed(1)}%`);
  
  if (failedTests === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed!');
  }
}

// Mock DICOM metadata object for testing
const mockDicomMetadata = {
  // Valid DICOM properties
  StudyInstanceUID: '1.2.3.4.5.6.7.8.9',
  SeriesInstanceUID: '1.2.3.4.5.6.7.8.10',
  SOPInstanceUID: '1.2.3.4.5.6.7.8.11',
  PatientName: 'Test^Patient',
  PatientID: 'P001',
  StudyDate: '20231201',
  Modality: 'CT',
  Rows: 512,
  Columns: 512,
  PixelSpacing: [0.5, 0.5],
  WindowCenter: 40,
  WindowWidth: 80,
  
  // DICOM tag format properties
  x00080016: 'SOPClassUID_Value',
  x00080018: 'SOPInstanceUID_Value',
  x00100010: 'PatientName_Value',
  
  // Potentially dangerous properties that should be blocked
  __proto__: { malicious: true },
  constructor: { malicious: true },
  prototype: { malicious: true },
  _private: 'should_not_access',
  
  // Custom properties for testing
  imageId: 'test-image-123',
  viewportId: 'viewport-1',
  toolName: 'length',
  enabled: true,
  status: 'active'
};

console.log('🧪 Starting Security Functions Test Suite\n');

// ===============================
// Test safeObjectAccess function
// ===============================
console.log('--- Testing safeObjectAccess ---');

// Test 1: Valid DICOM property access
assertEqual(
  safeObjectAccess(mockDicomMetadata, 'StudyInstanceUID'),
  '1.2.3.4.5.6.7.8.9',
  'Should access valid DICOM StudyInstanceUID'
);

// Test 2: Valid DICOM tag format access
assertEqual(
  safeObjectAccess(mockDicomMetadata, 'x00080016'),
  'SOPClassUID_Value',
  'Should access valid DICOM tag format x00080016'
);

// Test 3: Invalid key should return undefined
assertUndefined(
  safeObjectAccess(mockDicomMetadata, '__proto__'),
  'Should not access __proto__ property'
);

// Test 4: Invalid key should return undefined
assertUndefined(
  safeObjectAccess(mockDicomMetadata, 'constructor'),
  'Should not access constructor property'
);

// Test 5: Private property should return undefined
assertUndefined(
  safeObjectAccess(mockDicomMetadata, '_private'),
  'Should not access private property starting with underscore'
);

// Test 6: Non-existent property with default value
assertEqual(
  safeObjectAccess(mockDicomMetadata, 'NonExistent', 'default'),
  'default',
  'Should return default value for non-existent property'
);

// Test 7: Invalid key type (empty string)
assertUndefined(
  safeObjectAccess(mockDicomMetadata, ''),
  'Should not access property with empty string key'
);

// Test 8: Valid custom property
assertEqual(
  safeObjectAccess(mockDicomMetadata, 'imageId'),
  'test-image-123',
  'Should access valid custom property imageId'
);

// Test 9: Invalid DICOM tag format
assertUndefined(
  safeObjectAccess(mockDicomMetadata, 'x123'),
  'Should not access invalid DICOM tag format'
);

// Test 10: Non-string key type
assertUndefined(
  safeObjectAccess(mockDicomMetadata, 123),
  'Should not access property with non-string key'
);

// ===============================
// Test safeArrayAccess function
// ===============================
console.log('\n--- Testing safeArrayAccess ---');

const testArray = [10, 20, 30, 40, 50];

// Test 11: Valid array index access
assertEqual(
  safeArrayAccess(testArray, 2),
  30,
  'Should access valid array index 2'
);

// Test 12: First element access
assertEqual(
  safeArrayAccess(testArray, 0),
  10,
  'Should access first array element'
);

// Test 13: Last element access
assertEqual(
  safeArrayAccess(testArray, 4),
  50,
  'Should access last array element'
);

// Test 14: Out of bounds access (negative index)
assertUndefined(
  safeArrayAccess(testArray, -1),
  'Should not access negative array index'
);

// Test 15: Out of bounds access (too large index)
assertUndefined(
  safeArrayAccess(testArray, 10),
  'Should not access out-of-bounds array index'
);

// Test 16: Out of bounds with default value
assertEqual(
  safeArrayAccess(testArray, 10, 'default'),
  'default',
  'Should return default value for out-of-bounds access'
);

// Test 17: Non-array input
assertUndefined(
  safeArrayAccess({}, 0),
  'Should not access index on non-array object'
);

// Test 18: Invalid index type
assertUndefined(
  safeArrayAccess(testArray, 'invalid'),
  'Should not access array with non-number index'
);

// ===============================
// Test createSafeObject function
// ===============================
console.log('\n--- Testing createSafeObject ---');

const allowedKeys = ['StudyInstanceUID', 'PatientName', 'Modality', 'imageId'];

// Test 19: Create safe object with allowed keys
const safeObj = createSafeObject(mockDicomMetadata, allowedKeys);
assertEqual(
  safeObj.StudyInstanceUID,
  '1.2.3.4.5.6.7.8.9',
  'Safe object should contain allowed StudyInstanceUID'
);

// Test 20: Safe object should not contain blocked properties
assert(
  !Object.prototype.hasOwnProperty.call(safeObj, '__proto__'),
  'Safe object should not contain __proto__ property'
);

// Test 21: Safe object should not contain private properties
assert(
  !('_private' in safeObj),
  'Safe object should not contain private properties'
);

// Test 22: Safe object should contain valid custom property
assertEqual(
  safeObj.imageId,
  'test-image-123',
  'Safe object should contain allowed custom property'
);

// Test 23: Safe object should not contain non-allowed properties
assert(
  !('Rows' in safeObj),
  'Safe object should not contain non-allowed property Rows'
);

// ===============================
// Test isValidDICOMTag function
// ===============================
console.log('\n--- Testing isValidDICOMTag ---');

// Test 24: Valid DICOM tag format
assert(
  isValidDICOMTag('x00080016'),
  'Should validate correct DICOM tag format x00080016'
);

// Test 25: Valid DICOM tag with mixed case
assert(
  isValidDICOMTag('x0008001A'),
  'Should validate correct DICOM tag format with uppercase'
);

// Test 26: Invalid DICOM tag - too short
assert(
  !isValidDICOMTag('x123'),
  'Should reject too short DICOM tag'
);

// Test 27: Invalid DICOM tag - no x prefix
assert(
  !isValidDICOMTag('00080016'),
  'Should reject DICOM tag without x prefix'
);

// Test 28: Invalid DICOM tag - non-hex characters
assert(
  !isValidDICOMTag('x0008001G'),
  'Should reject DICOM tag with non-hex characters'
);

// Test 29: Invalid input type
assert(
  !isValidDICOMTag(123),
  'Should reject non-string input'
);

// ===============================
// Test getSafeKeys function
// ===============================
console.log('\n--- Testing getSafeKeys ---');

// Test 30: Get safe keys from object
const safeKeys = getSafeKeys(mockDicomMetadata);
assert(
  safeKeys.includes('StudyInstanceUID'),
  'Should include valid DICOM property in safe keys'
);

// Test 31: Should not include dangerous keys
assert(
  !safeKeys.includes('__proto__'),
  'Should not include __proto__ in safe keys'
);

// Test 32: Should not include constructor
assert(
  !safeKeys.includes('constructor'),
  'Should not include constructor in safe keys'
);

// Test 33: Should not include private keys
assert(
  !safeKeys.includes('_private'),
  'Should not include private keys starting with underscore'
);

// ===============================
// Integration Tests
// ===============================
console.log('\n--- Integration Tests ---');

// Test 34: Combined workflow - safe DICOM metadata processing
const processDicomMetadata = (metadata) => {
  const essentialKeys = ['StudyInstanceUID', 'SeriesInstanceUID', 'PatientName', 'Modality'];
  const safeMetadata = createSafeObject(metadata, essentialKeys);
  
  // Safely access nested array data
  const pixelSpacing = safeArrayAccess(metadata.PixelSpacing, 0, 1.0);
  
  return {
    ...safeMetadata,
    pixelSpacing
  };
};

const processedMetadata = processDicomMetadata(mockDicomMetadata);
assert(
  processedMetadata.StudyInstanceUID === '1.2.3.4.5.6.7.8.9' &&
  processedMetadata.pixelSpacing === 0.5 &&
  !Object.prototype.hasOwnProperty.call(processedMetadata, '__proto__'),
  'Integration test: Should safely process DICOM metadata'
);

// Test 35: Performance test - ensure functions don't break normal functionality
const performanceTest = () => {
  const start = Date.now();
  
  // Simulate typical usage patterns
  for (let i = 0; i < 1000; i++) {
    safeObjectAccess(mockDicomMetadata, 'StudyInstanceUID');
    safeArrayAccess([1, 2, 3, 4, 5], 2);
    isValidDICOMTag('x00080016');
  }
  
  const duration = Date.now() - start;
  return duration < 100; // Should complete within 100ms
};

assert(
  performanceTest(),
  'Performance test: Security functions should not significantly impact performance'
);

// Test 36: Malicious key injection attempt
const maliciousKeys = ['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__'];
let maliciousAccessBlocked = true;

for (const key of maliciousKeys) {
  const result = safeObjectAccess(mockDicomMetadata, key);
  if (result !== undefined) {
    maliciousAccessBlocked = false;
    break;
  }
}

assert(
  maliciousAccessBlocked,
  'Security test: Should block all malicious key injection attempts'
);

// Test 37: SQL injection style DICOM tag attempt
const maliciousDicomTag = "x00080016'; DROP TABLE metadata; --";
assertUndefined(
  safeObjectAccess(mockDicomMetadata, maliciousDicomTag),
  'Security test: Should block malicious DICOM tag injection'
);

// Test 38: Array bounds exploitation attempt
const exploitArray = [1, 2, 3];
assertUndefined(
  safeArrayAccess(exploitArray, -1),
  'Security test: Should prevent negative index exploitation'
);

assertUndefined(
  safeArrayAccess(exploitArray, 999999),
  'Security test: Should prevent large index exploitation'
);

// Test 39: Verify normal functionality still works
const normalUsage = () => {
  const metadata = {
    StudyInstanceUID: 'normal-study-id',
    SeriesInstanceUID: 'normal-series-id',
    PixelSpacing: [1.0, 1.0],
    x00080020: 'study-date'
  };
  
  const studyId = safeObjectAccess(metadata, 'StudyInstanceUID');
  const spacing = safeArrayAccess(metadata.PixelSpacing, 0);
  const studyDate = safeObjectAccess(metadata, 'x00080020');
  
  return studyId === 'normal-study-id' && spacing === 1.0 && studyDate === 'study-date';
};

assert(
  normalUsage(),
  'Functionality test: Normal DICOM operations should work correctly'
);

// Test 40: Edge case - empty objects and arrays
assertUndefined(
  safeObjectAccess({}, 'anyKey'),
  'Edge case: Empty object should return undefined'
);

assertUndefined(
  safeArrayAccess([], 0),
  'Edge case: Empty array should return undefined'
);

// Print final test summary
printTestSummary();

// Exit with appropriate code
process.exit(failedTests > 0 ? 1 : 0);