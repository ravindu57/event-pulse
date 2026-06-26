import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd, yyyy');
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMM dd');
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return differenceInDays(d, new Date());
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'on_track': return 'tertiary';
    case 'at_risk': return 'error';
    case 'stalled': return 'outline';
    case 'critical': return 'error';
    case 'completed': return 'secondary';
    case 'in_progress': return 'primary';
    default: return 'secondary';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'on_track': return 'On Track';
    case 'at_risk': return 'At Risk';
    case 'stalled': return 'Stalled';
    case 'critical': return 'Critical';
    case 'completed': return 'Completed';
    case 'in_progress': return 'In Progress';
    case 'upcoming': return 'Upcoming';
    default: return status;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'text-tertiary';
    case 'negative': return 'text-error';
    default: return 'text-primary';
  }
}

export function getSentimentLabel(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'Positive';
    case 'negative': return 'Needs Attention';
    default: return 'Neutral';
  }
}

// Mock data helper for demo without Supabase
export const EVENT_DATE = new Date('2026-09-15');
