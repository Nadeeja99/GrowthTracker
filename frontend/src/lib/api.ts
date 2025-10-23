// API Client for Backend Communication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  timezone: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
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

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  completedAt?: string;
  estimatedTime?: number;
  actualTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Schedule {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  recurring?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  createdAt: string;
  updatedAt: string;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  targetCount: number;
  createdAt: string;
  updatedAt: string;
}

// API Client Class
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Try to get token from localStorage
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Authentication
  async register(userData: {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success && response.data?.accessToken) {
      this.setToken(response.data.accessToken);
    }

    return response;
  }

  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data?.accessToken) {
      this.setToken(response.data.accessToken);
    }

    return response;
  }

  async logout(): Promise<ApiResponse> {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    if (response.success) {
      this.clearToken();
    }

    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/me');
  }

  // Goals
  async getGoals(): Promise<ApiResponse<{ goals: Goal[] }>> {
    return this.request('/goals');
  }

  async createGoal(goalData: {
    title: string;
    description?: string;
    targetDate?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  }): Promise<ApiResponse<{ goal: Goal }>> {
    return this.request('/goals', {
      method: 'POST',
      body: JSON.stringify(goalData),
    });
  }

  async updateGoal(id: string, goalData: Partial<Goal>): Promise<ApiResponse<{ goal: Goal }>> {
    return this.request(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(goalData),
    });
  }

  async deleteGoal(id: string): Promise<ApiResponse> {
    return this.request(`/goals/${id}`, {
      method: 'DELETE',
    });
  }

  // Tasks
  async getTasks(): Promise<ApiResponse<{ tasks: Task[] }>> {
    return this.request('/tasks');
  }

  async createTask(taskData: {
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: string;
    estimatedTime?: number;
    goalId?: string;
  }): Promise<ApiResponse<{ task: Task }>> {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(id: string, taskData: Partial<Task>): Promise<ApiResponse<{ task: Task }>> {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  async deleteTask(id: string): Promise<ApiResponse> {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Schedules
  async getSchedules(): Promise<ApiResponse<{ schedules: Schedule[] }>> {
    return this.request('/schedules');
  }

  async createSchedule(scheduleData: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    recurring?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  }): Promise<ApiResponse<{ schedule: Schedule }>> {
    return this.request('/schedules', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  }

  // Habits
  async getHabits(): Promise<ApiResponse<{ habits: Habit[] }>> {
    return this.request('/habits');
  }

  async createHabit(habitData: {
    name: string;
    description?: string;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    targetCount?: number;
  }): Promise<ApiResponse<{ habit: Habit }>> {
    return this.request('/habits', {
      method: 'POST',
      body: JSON.stringify(habitData),
    });
  }

  // Analytics
  async getAnalytics(): Promise<ApiResponse<any>> {
    return this.request('/analytics/overview');
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

// Create and export singleton instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export types
export type { ApiResponse, User, Goal, Task, Schedule, Habit };
