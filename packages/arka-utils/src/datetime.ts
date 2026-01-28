/**
 * ARKA DateTime Utilities
 *
 * Utilities for handling dates and times consistently.
 */

/**
 * Returns the current time as an ISO string
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Parses an ISO date string to a Date object
 */
export function parseISODate(isoString: string): Date {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO date string: ${isoString}`);
  }
  return date;
}

/**
 * Checks if a date is within a range
 */
export function isWithinRange(
  date: string | Date,
  start?: string | null,
  end?: string | null
): boolean {
  const dateObj = typeof date === 'string' ? parseISODate(date) : date;
  const dateMs = dateObj.getTime();

  if (start) {
    const startMs = parseISODate(start).getTime();
    if (dateMs < startMs) return false;
  }

  if (end) {
    const endMs = parseISODate(end).getTime();
    if (dateMs > endMs) return false;
  }

  return true;
}

/**
 * Checks if a rule is effective at a given date
 */
export function isEffective(
  effectiveFrom?: string | null,
  effectiveTo?: string | null,
  atDate?: string | Date
): boolean {
  const checkDate = atDate
    ? (typeof atDate === 'string' ? parseISODate(atDate) : atDate)
    : new Date();

  return isWithinRange(checkDate, effectiveFrom, effectiveTo);
}

/**
 * Returns start of day for a given date
 */
export function startOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns end of day for a given date
 */
export function endOfDay(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Adds days to a date
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? parseISODate(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Calculates duration between two dates in milliseconds
 */
export function durationMs(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISODate(start) : start;
  const endDate = typeof end === 'string' ? parseISODate(end) : end;
  return endDate.getTime() - startDate.getTime();
}

/**
 * Formats duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}
