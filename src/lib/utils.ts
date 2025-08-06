import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safe Property Access Utilities
 * Prevents Object Injection vulnerabilities by validating property access
 * As required by medical software security standards
 */

/**
 * Safely access object properties to prevent Object Injection attacks
 */
export function safePropertyAccess<T extends object, K extends keyof T>(
  obj: T,
  key: K,
): T[K] | undefined {
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key is constrained to keyof T by TypeScript
    return obj[key];
  }
  return undefined;
}

/**
 * Safely set object properties with type validation
 */
export function safePropertySet<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: unknown,
): void {
  if (typeof key === 'string' || typeof key === 'number' || typeof key === 'symbol') {
    // eslint-disable-next-line security/detect-object-injection -- Safe: key type is validated and constrained to keyof T
    (obj as Record<string | number | symbol, unknown>)[key] = value;
  }
}

/**
 * Safely access nested object properties with path validation
 */
export function safeNestedAccess<T>(obj: T, path: string): unknown {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, key)) {
      return undefined;
    }
    // eslint-disable-next-line security/detect-object-injection -- Safe: key existence is validated with hasOwnProperty
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * Safely check if object has property without Object Injection risk
 */
export function safeHasProperty<T extends object>(obj: T, prop: string | number | symbol): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Get safe object keys with validation
 */
export function safeObjectKeys<T extends object>(obj: T): Array<keyof T> {
  if (!obj || typeof obj !== 'object') {
    return [];
  }
  return Object.keys(obj) as Array<keyof T>;
}
