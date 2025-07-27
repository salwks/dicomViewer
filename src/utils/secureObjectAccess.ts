/**
 * Secure Object Access Utilities
 *
 * Essential security utilities for safe object and array access.
 * Unused exports have been removed to improve bundle size and maintainability.
 */

/**
 * Safely access array elements with bounds checking
 * Used in progressive loading and measurement-related operations
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
