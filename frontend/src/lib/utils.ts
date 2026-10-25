import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string): string {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getProgressPercentage(current: number, target: number): number {
  return Math.min((current / target) * 100, 100);
}

export function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-emerald-500';
  if (percentage >= 70) return 'bg-blue-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-orange-500';
}

export function getStreakColor(days: number): string {
  if (days >= 14) return 'text-emerald-500';
  if (days >= 7) return 'text-blue-500';
  if (days >= 3) return 'text-yellow-500';
  return 'text-gray-500';
}

export function getCategoryBadgeColor(category: 'high' | 'medium' | 'low'): string {
  switch (category) {
    case 'high': return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300';
    case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300';
    case 'low': return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300';
  }
}
