/**
 * Calculate days between two date strings.
 */
export function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(startStr);
  const end = new Date(endStr);
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get a date N months ago from now.
 */
export function monthsAgo(n: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - n);
  return date;
}

/**
 * Check if a date is in the future.
 */
export function isFuture(dateStr: string): boolean {
  return new Date(dateStr) > new Date();
}

/**
 * Get the relative time description (e.g., "3 days ago", "in 5 days").
 */
export function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}
