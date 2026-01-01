// Mapper to convert between frontend Goal type and backend Goal API type

import { Goal } from '@/types';

// Backend Goal type from API
interface BackendGoal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Maps backend Goal API response to frontend Goal type
 */
export function mapBackendGoalToFrontend(backendGoal: BackendGoal): Goal {
  // Map priority enum to number (for display purposes)
  const priorityMap: Record<string, number> = {
    'LOW': 1,
    'MEDIUM': 2,
    'HIGH': 3,
    'URGENT': 4,
  };

  // Map priority to category for UI
  const categoryMap: Record<string, 'high' | 'medium' | 'low'> = {
    'LOW': 'low',
    'MEDIUM': 'medium',
    'HIGH': 'high',
    'URGENT': 'high',
  };

  // Generate color based on goal ID (consistent per goal)
  const colors = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#6366F1'  // Indigo
  ];
  const colorIndex = parseInt(backendGoal.id.slice(-1), 16) % colors.length;
  let color = colors[colorIndex];
  let targetHoursWeekly = 10;
  let targetHoursDaily = 1.5;

  // Try to parse metadata from description
  if (backendGoal.description) {
    try {
      const metadata = JSON.parse(backendGoal.description);
      if (metadata.color) color = metadata.color;
      if (metadata.targetHoursWeekly) targetHoursWeekly = metadata.targetHoursWeekly;
      if (metadata.targetHoursDaily) targetHoursDaily = metadata.targetHoursDaily;
    } catch (e) {
      // Description is not JSON, use defaults
    }
  }

  return {
    id: backendGoal.id,
    name: backendGoal.title,
    color: color,
    category: categoryMap[backendGoal.priority] || 'medium',
    targetHoursWeekly: targetHoursWeekly,
    targetHoursDaily: targetHoursDaily,
    currentWeeklyHours: 0, // This would need to be calculated from activities/schedules
    streakDays: 0, // This would need to be calculated from habit completions
    createdAt: backendGoal.createdAt,
    priority: priorityMap[backendGoal.priority] || 2,
  };
}

/**
 * Maps frontend Goal type to backend Goal API request format
 */
export function mapFrontendGoalToBackend(frontendGoal: {
  name: string;
  category: 'high' | 'medium' | 'low';
  targetHoursWeekly?: number;
  targetHoursDaily?: number;
  color?: string;
  priority?: number;
}): {
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  targetDate?: string;
} {
  // Map category/priority to backend priority enum
  const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
    'low': 'LOW',
    'medium': 'MEDIUM',
    'high': 'HIGH',
  };

  // Use category to determine priority, or use priority number if available
  let priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' = priorityMap[frontendGoal.category] || 'MEDIUM';
  
  if (frontendGoal.priority) {
    if (frontendGoal.priority >= 4) priority = 'URGENT';
    else if (frontendGoal.priority >= 3) priority = 'HIGH';
    else if (frontendGoal.priority >= 2) priority = 'MEDIUM';
    else priority = 'LOW';
  }

  // Store additional frontend-specific data in description
  // Keep it under 500 characters (backend limit)
  const metadata = {
    targetHoursWeekly: frontendGoal.targetHoursWeekly || 10,
    targetHoursDaily: frontendGoal.targetHoursDaily || 1.5,
    color: frontendGoal.color || '#3B82F6',
  };

  const description = JSON.stringify(metadata);
  
  // Ensure description doesn't exceed backend limit
  if (description.length > 500) {
    console.warn('Goal description exceeds 500 characters, truncating metadata');
    // If too long, just store essential data
    const minimalMetadata = {
      color: frontendGoal.color || '#3B82F6',
    };
    return {
      title: frontendGoal.name,
      description: JSON.stringify(minimalMetadata),
      priority,
    };
  }

  return {
    title: frontendGoal.name,
    description: description,
    priority,
  };
}

/**
 * Maps partial frontend Goal updates to backend format
 */
export function mapFrontendGoalUpdateToBackend(updates: Partial<Goal>): {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress?: number;
} {
  const result: any = {};

  if (updates.name !== undefined) {
    result.title = updates.name;
  }

  if (updates.category !== undefined || updates.targetHoursWeekly !== undefined || 
      updates.targetHoursDaily !== undefined || updates.color !== undefined) {
    const metadata = {
      targetHoursWeekly: updates.targetHoursWeekly || 10,
      targetHoursDaily: updates.targetHoursDaily || 1.5,
      color: updates.color || '#3B82F6',
    };
    result.description = JSON.stringify(metadata);
  }

  if (updates.priority !== undefined || updates.category !== undefined) {
    const category = updates.category || 'medium';
    const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
      'low': 'LOW',
      'medium': 'MEDIUM',
      'high': 'HIGH',
    };
    result.priority = priorityMap[category] || 'MEDIUM';
    
    if (updates.priority) {
      if (updates.priority >= 4) result.priority = 'URGENT';
      else if (updates.priority >= 3) result.priority = 'HIGH';
      else if (updates.priority >= 2) result.priority = 'MEDIUM';
      else result.priority = 'LOW';
    }
  }

  return result;
}

