/**
 * Utility functions
 * Common utilities for the DICOM viewer application
 */

export { cn } from '@/lib/utils';

/**
 * Safe property access helper to prevent object injection vulnerabilities
 */
export function safePropertyAccess<T extends object, K extends keyof T>(obj: T, key: K): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection
    return obj[key];
  }
  return undefined;
}

/**
 * Safe property setter to prevent object injection vulnerabilities
 */
export function safePropertySet<T extends object>(obj: T, key: keyof T, value: unknown): void {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key is validated keyof T
    (obj as Record<string | number | symbol, unknown>)[key] = value;
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Generate unique ID for components and viewports
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  // eslint-disable-next-line security/detect-object-injection -- Safe: i is calculated array index for known sizes array
  const size = sizes[i];

  if (size === undefined) {
    return '0 Bytes';
  }

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm)).toString()} ${size}`;
}
