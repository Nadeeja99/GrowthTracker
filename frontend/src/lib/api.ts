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

export interface BackendGoal {
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

export interface BackendTask {
  id: string;
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  completedAt?: string;
  estimatedTime?: number;
  actualTime?: number;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ name: string }>;
}

export interface BackendSchedule {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'RESCHEDULED';
  notes?: string;
  actualTimeSpent?: number;
  goalId?: string;
  taskId?: string;
  createdAt: string;
  updatedAt: string;
  goal?: { id: string; title: string };
  task?: { id: string; title: string; status: string };
}

export interface BackendHabit {
  id: string;
  name: string;
  description?: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  targetCount: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { completions: number };
}

export interface BackendHabitCompletion {
  id: string;
  date: string;
  count: number;
  notes?: string;
  habitId: string;
  createdAt: string;
}

export interface BackendHabitWithCompletions extends BackendHabit {
  completions: BackendHabitCompletion[];
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (response.status === 401) {
      this.clearToken();
    }

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  // Auth
  async register(userData: { email: string; username: string; password: string; firstName?: string; lastName?: string }): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.success && response.data?.accessToken) {
      this.setToken(response.data.accessToken);
    }
    return response;
  }

  async login(credentials: { email: string; password: string }): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request<{ user: User; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (response.success && response.data?.accessToken) {
      this.setToken(response.data.accessToken);
    }
    return response;
  }

  async logout(): Promise<ApiResponse> {
    try {
      const response = await this.request('/auth/logout', { method: 'POST' });
      return response;
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/me');
  }

  // Goals
  async getGoals(): Promise<ApiResponse<{ goals: BackendGoal[] }>> {
    return this.request('/goals?limit=500');
  }

  async createGoal(goalData: { title: string; description?: string; targetDate?: string; priority?: string }): Promise<ApiResponse<{ goal: BackendGoal }>> {
    return this.request('/goals', { method: 'POST', body: JSON.stringify(goalData) });
  }

  async updateGoal(id: string, goalData: Partial<BackendGoal>): Promise<ApiResponse<{ goal: BackendGoal }>> {
    return this.request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(goalData) });
  }

  async deleteGoal(id: string): Promise<ApiResponse> {
    return this.request(`/goals/${id}`, { method: 'DELETE' });
  }

  // Tasks
  async getTasks(): Promise<ApiResponse<{ tasks: BackendTask[] }>> {
    return this.request('/tasks?limit=500');
  }

  async createTask(taskData: {
    title: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    estimatedTime?: number;
    goalId?: string;
  }): Promise<ApiResponse<{ task: BackendTask }>> {
    return this.request('/tasks', { method: 'POST', body: JSON.stringify(taskData) });
  }

  async updateTask(id: string, taskData: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string;
    estimatedTime?: number;
    actualTime?: number;
    goalId?: string | null;
  }): Promise<ApiResponse<{ task: BackendTask }>> {
    return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(taskData) });
  }

  async deleteTask(id: string): Promise<ApiResponse> {
    return this.request(`/tasks/${id}`, { method: 'DELETE' });
  }

  // Schedules
  async getSchedules(startDate?: string, endDate?: string): Promise<ApiResponse<{ schedules: BackendSchedule[] }>> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return this.request(`/schedules${query ? `?${query}` : ''}`);
  }

  async createSchedule(scheduleData: {
    title: string;
    startTime: string;
    endTime: string;
    status?: string;
    notes?: string;
    actualTimeSpent?: number;
    goalId?: string;
    taskId?: string;
  }): Promise<ApiResponse<{ schedule: BackendSchedule }>> {
    return this.request('/schedules', { method: 'POST', body: JSON.stringify(scheduleData) });
  }

  async updateSchedule(id: string, scheduleData: {
    title?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    notes?: string;
    actualTimeSpent?: number;
    goalId?: string | null;
    taskId?: string | null;
  }): Promise<ApiResponse<{ schedule: BackendSchedule }>> {
    return this.request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(scheduleData) });
  }

  async deleteSchedule(id: string): Promise<ApiResponse> {
    return this.request(`/schedules/${id}`, { method: 'DELETE' });
  }

  // Habits
  async getHabits(): Promise<ApiResponse<{ habits: BackendHabit[] }>> {
    return this.request('/habits?limit=500');
  }

  async getHabitWithCompletions(id: string): Promise<ApiResponse<{ habit: BackendHabitWithCompletions }>> {
    return this.request(`/habits/${id}`);
  }

  async createHabit(data: { name: string; description?: string; frequency: string; targetCount?: number }): Promise<ApiResponse<{ habit: BackendHabit }>> {
    return this.request('/habits', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateHabit(id: string, data: { name?: string; description?: string; frequency?: string; targetCount?: number }): Promise<ApiResponse<{ habit: BackendHabit }>> {
    return this.request(`/habits/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteHabit(id: string): Promise<ApiResponse> {
    return this.request(`/habits/${id}`, { method: 'DELETE' });
  }

  async completeHabit(id: string, data: { date: string; count?: number; notes?: string }): Promise<ApiResponse<{ completion: any }>> {
    return this.request(`/habits/${id}/complete`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Users
  async updateProfile(data: { firstName?: string; lastName?: string; timezone?: string; avatar?: string }): Promise<ApiResponse<{ user: User }>> {
    return this.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getUserStats(): Promise<ApiResponse<any>> {
    return this.request('/users/stats');
  }

  // Analytics
  async getAnalyticsOverview(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const query = params.toString();
    return this.request(`/analytics/overview${query ? `?${query}` : ''}`);
  }

  async getGoalProgressAnalytics(): Promise<ApiResponse<any>> {
    return this.request('/analytics/goal-progress');
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

export const apiClient = new ApiClient(API_BASE_URL);
