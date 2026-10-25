const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export type BackendPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AnalyticsOverview {
  period: { startDate: string; endDate: string; timezone: string };
  goals: { total: number; active: number; completed: number; completionRate: number; averageActiveProgress: number };
  tasks: {
    total: number; completed: number; completionRate: number;
    timeEfficiency: number; totalEstimatedTime: number; totalActualTime: number;
  };
  habits: { total: number; completionRate: number };
  focus: { sessions: number; totalMinutes: number; completionRate: number };
  reflections: { days: number; averagePerformance: number | null; averageEnergy: number | null; averageMood: number | null };
}

export interface ScheduleWritePayload {
  title: string;
  startTime: string;
  endTime: string;
  status?: string;
  notes?: string;
  actualTimeSpent?: number;
  goalId?: string;
  taskId?: string;
}

export interface ApiResponse<T = unknown> {
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

export interface BackendMilestone {
  id: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
  completed: boolean;
  goalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendGoal {
  id: string;
  title: string;
  description?: string | null;
  targetDate?: string | null;
  priority: BackendPriority;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress: number;
  color: string;
  targetHoursWeekly: number;
  targetHoursDaily: number;
  milestones?: BackendMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface GoalWritePayload {
  title?: string;
  description?: string | null;
  targetDate?: string | null;
  priority?: BackendPriority;
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
  progress?: number;
  color?: string;
  targetHoursWeekly?: number;
  targetHoursDaily?: number;
}

export interface BackendSubtask {
  id: string;
  title: string;
  completed: boolean;
  position: number;
}

export interface SubtaskWritePayload {
  id?: string;
  title: string;
  completed: boolean;
}

export interface BackendReflection {
  id: string;
  date: string; // YYYY-MM-DD
  performance: number | null;
  energy: number | null;
  mood: number | null;
  notes: string | null;
}

export type ReflectionPayload = Pick<BackendReflection, 'performance' | 'energy' | 'mood' | 'notes'>;

export interface BackendFocusSession {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  plannedSeconds: number;
  completed: boolean;
  goalId: string | null;
  taskId: string | null;
  scheduleId: string | null;
}

export type FocusSessionPayload = Omit<BackendFocusSession, 'id' | 'goalId' | 'taskId' | 'scheduleId'> & {
  goalId?: string;
  taskId?: string;
  scheduleId?: string;
};

export interface BackendTask {
  id: string;
  title: string;
  description?: string;
  priority: BackendPriority;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  completedAt?: string;
  estimatedTime?: number;
  actualTime?: number;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: Array<{ name: string }>;
  subtasks?: BackendSubtask[];
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

// Auth endpoints that must never trigger the refresh-and-retry path.
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

class ApiClient {
  private baseURL: string;
  // The access token lives only in memory (never localStorage), so injected
  // scripts can't read it from storage. It is short-lived and restored on
  // page load from the httpOnly refresh cookie via refreshSession().
  private token: string | null = null;
  private refreshInFlight: Promise<User | null> | null = null;
  private sessionExpiredListener: (() => void) | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    if (typeof window !== 'undefined') {
      // Older versions persisted the token; remove it.
      localStorage.removeItem('accessToken');
    }
  }

  /** Called when the session can't be renewed and the user must sign in again. */
  onSessionExpired(listener: (() => void) | null): void {
    this.sessionExpiredListener = listener;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, isRetry = false): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.token}`;
    }

    // `include` sends the httpOnly refresh cookie to the /auth endpoints.
    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    // Proxies and cold-starting hosts can answer with HTML, so don't assume JSON.
    const data = await response.json().catch(() => ({}));

    // Access tokens expire after minutes: renew once, then replay the request.
    if (response.status === 401 && !isRetry && !NO_REFRESH_ENDPOINTS.includes(endpoint)) {
      const user = await this.refreshSession();
      if (user) return this.request<T>(endpoint, options, true);
      this.sessionExpiredListener?.();
    }

    if (!response.ok) {
      const fieldError: string | undefined = data.validationErrors?.[0]?.message;
      throw new Error(fieldError || data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  // Auth
  async register(userData: { email: string; username: string; password: string; firstName?: string; lastName?: string }): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request<{ user: User; accessToken: string }>('/auth/register', {
      method: 'POST',
      // Store the browser's time zone so "today", streaks and analytics use the user's calendar day.
      body: JSON.stringify({ ...userData, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
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

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers
   * share one request. Resolves to the user, or null when there's no session.
   */
  refreshSession(): Promise<User | null> {
    this.refreshInFlight ??= this.request<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then(res => {
        if (!res.data?.accessToken) return null;
        this.setToken(res.data.accessToken);
        return res.data.user;
      })
      .catch(() => {
        this.clearToken();
        return null;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  async logoutEverywhere(): Promise<ApiResponse> {
    try {
      return await this.request('/auth/logout-all', { method: 'POST' });
    } finally {
      this.clearToken();
    }
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

  async createGoal(goalData: GoalWritePayload & { title: string }): Promise<ApiResponse<{ goal: BackendGoal }>> {
    return this.request('/goals', { method: 'POST', body: JSON.stringify(goalData) });
  }

  async updateGoal(id: string, goalData: GoalWritePayload): Promise<ApiResponse<{ goal: BackendGoal }>> {
    return this.request(`/goals/${id}`, { method: 'PUT', body: JSON.stringify(goalData) });
  }

  // Milestones (responses include the parent goal, whose progress they drive)
  async createMilestone(goalId: string, data: { title: string; targetDate?: string }): Promise<ApiResponse<{ milestone: BackendMilestone; goal: BackendGoal }>> {
    return this.request(`/goals/${goalId}/milestones`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateMilestone(id: string, data: { title?: string; completed?: boolean; targetDate?: string | null }): Promise<ApiResponse<{ milestone: BackendMilestone; goal: BackendGoal }>> {
    return this.request(`/milestones/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteMilestone(id: string): Promise<ApiResponse<{ goal: BackendGoal }>> {
    return this.request(`/milestones/${id}`, { method: 'DELETE' });
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
    tags?: string[];
    subtasks?: SubtaskWritePayload[];
  }): Promise<ApiResponse<{ task: BackendTask }>> {
    return this.request('/tasks', { method: 'POST', body: JSON.stringify(taskData) });
  }

  async updateTask(id: string, taskData: {
    title?: string;
    description?: string;
    priority?: string;
    status?: string;
    dueDate?: string | null;
    estimatedTime?: number;
    actualTime?: number;
    goalId?: string | null;
    tags?: string[];
    subtasks?: SubtaskWritePayload[];
  }): Promise<ApiResponse<{ task: BackendTask }>> {
    return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(taskData) });
  }

  async updateSubtask(taskId: string, subtaskId: string, data: { title?: string; completed?: boolean }): Promise<ApiResponse<{ subtask: BackendSubtask }>> {
    return this.request(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'PATCH', body: JSON.stringify(data) });
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

  async createSchedule(scheduleData: ScheduleWritePayload): Promise<ApiResponse<{ schedule: BackendSchedule }>> {
    return this.request('/schedules', { method: 'POST', body: JSON.stringify(scheduleData) });
  }

  async createSchedulesBulk(schedules: ScheduleWritePayload[]): Promise<ApiResponse<{ count: number }>> {
    return this.request('/schedules/bulk', { method: 'POST', body: JSON.stringify({ schedules }) });
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
  // The list includes each habit's completions for the last year.
  async getHabits(): Promise<ApiResponse<{ habits: BackendHabitWithCompletions[] }>> {
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

  async completeHabit(id: string, data: { date: string; count?: number; notes?: string }): Promise<ApiResponse<{ completion: BackendHabitCompletion }>> {
    return this.request(`/habits/${id}/complete`, { method: 'POST', body: JSON.stringify(data) });
  }

  // Analytics
  async getAnalyticsOverview(startDate: string, endDate: string): Promise<ApiResponse<{ analytics: AnalyticsOverview }>> {
    const params = new URLSearchParams({ startDate, endDate });
    return this.request(`/analytics/overview?${params}`);
  }

  // Reflections (daily reviews)
  async getReflections(): Promise<ApiResponse<{ reflections: BackendReflection[] }>> {
    return this.request('/reflections');
  }

  async saveReflection(date: string, data: ReflectionPayload): Promise<ApiResponse<{ reflection: BackendReflection }>> {
    return this.request(`/reflections/${date}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async importReflections(reflections: Array<ReflectionPayload & { date: string }>): Promise<ApiResponse<{ imported: number }>> {
    return this.request('/reflections/import', { method: 'POST', body: JSON.stringify({ reflections }) });
  }

  // Focus sessions
  async getFocusSessions(startDate?: string): Promise<ApiResponse<{ sessions: BackendFocusSession[] }>> {
    return this.request(`/focus-sessions${startDate ? `?startDate=${encodeURIComponent(startDate)}` : ''}`);
  }

  async createFocusSession(data: FocusSessionPayload): Promise<ApiResponse<{ session: BackendFocusSession }>> {
    return this.request('/focus-sessions', { method: 'POST', body: JSON.stringify(data) });
  }

  // Users
  async updateProfile(data: { firstName?: string; lastName?: string; timezone?: string; avatar?: string }): Promise<ApiResponse<{ user: User }>> {
    return this.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) });
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
