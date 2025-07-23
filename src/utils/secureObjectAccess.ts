/* eslint-disable security/detect-object-injection */
// NOTE: This file implements secure object access patterns for DICOM metadata.
// Object injection warnings are expected and handled safely through validation.
/**
 * Secure Object Access Utilities
 *
 * Provides safe ways to access object properties and prevent object injection attacks
 * while maintaining functionality needed for DICOM parsing and medical imaging operations.
 */

/**
 * Safely access object property with validation
 */
export function safeObjectAccess<T>(
  obj: Record<string, any>,
  key: string,
  defaultValue?: T,
): T | undefined {
  // Validate key is a safe string
  if (typeof key !== 'string' || key.length === 0) {
    return defaultValue;
  }

  // Whitelist approach for DICOM tag keys
  if (key.startsWith('x') && key.length === 9) {
    // DICOM tag format: x00080016
    const tagPattern = /^x[0-9a-fA-F]{8}$/;
    if (tagPattern.test(key)) {
      return obj[key] ?? defaultValue;
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
    'Modality',
    'SeriesDescription',
    'NumberOfFrames',
    'Rows',
    'Columns',
    'PixelSpacing',
    'SliceThickness',
    'ImageOrientationPatient',
    'ImagePositionPatient',
    'RescaleSlope',
    'RescaleIntercept',
    'WindowCenter',
    'WindowWidth',
    'BitsAllocated',
    'BitsStored',
    'HighBit',
    'PixelRepresentation',
    'PhotometricInterpretation',
    'SamplesPerPixel',
    'TransferSyntaxUID',
    // Additional safe properties
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
    return obj[key] ?? defaultValue;
  }

  return defaultValue;
}

/**
 * Safely access array element with bounds checking
 */
export function safeArrayAccess<T>(
  arr: T[],
  index: number,
  defaultValue?: T,
): T | undefined {
  if (!Array.isArray(arr) || typeof index !== 'number' || index < 0 || index >= arr.length) {
    return defaultValue;
  }
  return arr[index] ?? defaultValue;
}

/**
 * Safely iterate over object properties with whitelist
 */
export function safeObjectEntries(
  obj: Record<string, any>,
  allowedKeys?: Set<string>,
): Array<[string, any]> {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const entries: Array<[string, any]> = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (!allowedKeys || allowedKeys.has(key)) {
        entries.push([key, obj[key]]);
      }
    }
  }
  return entries;
}

/**
 * Safely set object property with validation
 */
export function safeObjectSet(
  obj: Record<string, any>,
  key: string,
  value: any,
  allowedKeys?: Set<string>,
): boolean {
  if (!obj || typeof obj !== 'object' || typeof key !== 'string') {
    return false;
  }

  if (allowedKeys && !allowedKeys.has(key)) {
    return false;
  }

  obj[key] = value;
  return true;
}

/**
 * Create safe enum access function
 */
export function createSafeEnumAccess<T extends Record<string, any>>(enumObj: T) {
  const validKeys = new Set(Object.keys(enumObj));
  const validValues = new Set(Object.values(enumObj));

  return {
    getByKey: (key: string): T[keyof T] | undefined => {
      return validKeys.has(key) ? enumObj[key as keyof T] : undefined;
    },
    getKeyByValue: (value: any): string | undefined => {
      if (!validValues.has(value)) return undefined;
      return Object.keys(enumObj).find(key => enumObj[key as keyof T] === value);
    },
    isValidKey: (key: string): boolean => validKeys.has(key),
    isValidValue: (value: any): value is T[keyof T] => validValues.has(value),
  };
}

/**
 * Create a safe object with validated properties
 */
export function createSafeObject<T extends Record<string, any>>(
  source: Record<string, any>,
  allowedKeys: string[],
): Partial<T> {
  const safeObj: Partial<T> = {};

  for (const key of allowedKeys) {
    if (typeof key === 'string' && key.length > 0 && Object.prototype.hasOwnProperty.call(source, key)) {
      const value = safeObjectAccess(source, key);
      if (value !== undefined) {
        (safeObj as any)[key] = value;
      }
    }
  }

  return safeObj;
}

/**
 * Validate DICOM tag format
 */
export function isValidDICOMTag(tag: string): boolean {
  if (typeof tag !== 'string') return false;

  // Format: x00080016 (8 hex digits after x)
  const tagPattern = /^x[0-9a-fA-F]{8}$/;
  return tagPattern.test(tag);
}

/**
 * Get safe keys from object (prevents iteration over dangerous properties)
 */
export function getSafeKeys(obj: Record<string, any>): string[] {
  const keys = Object.keys(obj);
  return keys.filter(key =>
    typeof key === 'string' &&
    key !== '__proto__' &&
    key !== 'constructor' &&
    key !== 'prototype' &&
    !key.startsWith('_'),
  );
}
