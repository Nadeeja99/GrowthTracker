// Same-origin by default: /api is proxied to the API by next.config.js.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  /** The shared demo account (reset regularly; some actions are disabled). */
  isDemo?: boolean;
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

/** An action the coach proposed, validated by the API and ready to apply. */
export type CoachSuggestion = {
  id: string;
  title: string;
  reason: string;
  /** Id of the task, block or habit created when the user added it. */
  appliedId?: string;
} & (
  | { kind: 'task'; goalId: string | null; priority: BackendPriority; dueDate: string | null }
  | { kind: 'time_block'; goalId: string | null; startTime: string; endTime: string }
  | { kind: 'habit'; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' }
);

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions: CoachSuggestion[];
  createdAt: string;
}

export interface CoachUsage {
  used: number;
  limit: number;
  remaining: number;
}

export interface CoachStatus {
  /** The server has an AI provider configured. */
  configured: boolean;
  /** The user has opted in. */
  enabled: boolean;
  usage: CoachUsage;
  messages: CoachMessage[];
}

export interface CoachTurn {
  userMessage: CoachMessage;
  message: CoachMessage;
  usage: CoachUsage;
}

export interface WeeklyReviewContent {
  headline: string;
  wins: string[];
  slips: string[];
  patterns: Array<{ observation: string; evidence: string }>;
  priorities: Array<{ title: string; why: string; goalId: string | null }>;
}

export interface WeeklyReview {
  weekStart: string;
  content: WeeklyReviewContent;
  generatedAt: string;
}

export interface PlannedBlock {
  id: string;
  title: string;
  goalId: string | null;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface WeekPlan {
  summary: string;
  blocks: PlannedBlock[];
}

export interface SuggestedMilestone {
  title: string;
  targetDate: string | null;
  why: string;
}

/** An error response from the API, with its HTTP status. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth endpoints that must never trigger the refresh-and-retry path.
const NO_REFRESH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/demo', '/auth/refresh', '/auth/logout'];

// Render's free tier stops the API after 15 idle minutes. Requests forwarded by
// the app's server don't start it again: Render answers them at once with its
// own 502 page. A request straight from the browser does start it, so the
// client pings the API directly and retries until it answers.
const API_WAKE_URL = process.env.NEXT_PUBLIC_API_WAKE_URL;
const WAKE_TIMEOUT_MS = 90_000;
const WAKE_RETRY_DELAY_MS = 3_000;

/**
 * The host's error page for a stopped API, as opposed to one of the API's own
 * (JSON) errors. Such a request never reached the API, so it is safe to resend.
 */
const isApiAsleep = (response: Response) =>
  (response.status === 502 || response.status === 503) &&
  !response.headers.get('Content-Type')?.includes('application/json');

class ApiClient {
  private baseURL: string;
  // The access token lives only in memory (never localStorage), so injected
  // scripts can't read it from storage. It is short-lived and restored on
  // page load from the httpOnly refresh cookie via refreshSession().
  private token: string | null = null;
  private refreshInFlight: Promise<User | null> | null = null;
  private wakeInFlight: Promise<void> | null = null;
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

    const headers: HeadersInit = { ...this.jsonHeaders(), ...options.headers };

    // `include` sends the httpOnly refresh cookie to the /auth endpoints.
    const send = () => fetch(url, { ...options, headers, credentials: 'include' });
    let response = await send();
    if (isApiAsleep(response)) response = await this.waitForApi(send);
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
      throw new ApiError(fieldError || data.error || `HTTP ${response.status}`, response.status);
    }

    return data;
  }

  /**
   * Resends `send` until the API is awake (see isApiAsleep), waking it from
   * the browser before each try. Gives up after WAKE_TIMEOUT_MS and returns
   * the last response.
   */
  private async waitForApi(send: () => Promise<Response>): Promise<Response> {
    const deadline = Date.now() + WAKE_TIMEOUT_MS;
    for (;;) {
      await this.wakeApi();
      const response = await send();
      if (!isApiAsleep(response) || Date.now() >= deadline) return response;
      await new Promise(resolve => setTimeout(resolve, WAKE_RETRY_DELAY_MS));
    }
  }

  /** Concurrent callers share one ping; Render holds it open until the API is up. */
  private wakeApi(): Promise<void> {
    if (!API_WAKE_URL) return Promise.resolve();
    this.wakeInFlight ??= fetch(API_WAKE_URL, { cache: 'no-store' })
      // Only the wake-up matters, not the answer.
      .then(() => undefined, () => undefined)
      .finally(() => {
        this.wakeInFlight = null;
      });
    return this.wakeInFlight;
  }

  private jsonHeaders(): Record<string, string> {
    return this.token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` }
      : { 'Content-Type': 'application/json' };
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

  /** Signs in to the shared demo account ("Try the demo"). */
  async loginDemo(): Promise<ApiResponse<{ user: User; accessToken: string }>> {
    const response = await this.request<{ user: User; accessToken: string }>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (response.data?.accessToken) this.setToken(response.data.accessToken);
    return response;
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers
   * share one request. Resolves to the user, or null when there is no
   * session (no cookie, or a 401). Other failures (rate limit, server or
   * network errors) are thrown instead, so a temporary problem never signs
   * the user out.
   */
  refreshSession(): Promise<User | null> {
    this.refreshInFlight ??= this.request<{ user: User; accessToken: string }>('/auth/refresh', { method: 'POST' })
      .then(res => {
        if (!res.data?.accessToken) return null;
        this.setToken(res.data.accessToken);
        return res.data.user;
      })
      .catch(error => {
        if (error instanceof ApiError && error.status === 401) {
          this.clearToken();
          return null;
        }
        throw error;
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

  // AI coach
  async getCoach(): Promise<ApiResponse<CoachStatus>> {
    return this.request('/coach');
  }

  async setCoachEnabled(enabled: boolean): Promise<ApiResponse<{ enabled: boolean }>> {
    return this.request('/coach/settings', { method: 'PUT', body: JSON.stringify({ enabled }) });
  }

  async clearCoachMessages(): Promise<ApiResponse<{ deleted: number }>> {
    return this.request('/coach/messages', { method: 'DELETE' });
  }

  async applyCoachSuggestion(messageId: string, suggestionId: string): Promise<ApiResponse<{ suggestion: CoachSuggestion }>> {
    return this.request(`/coach/messages/${messageId}/suggestions/${suggestionId}/apply`, { method: 'POST' });
  }

  /**
   * Sends a message to the coach and streams the reply (Server-Sent Events).
   * `onDelta` receives each fragment as it arrives; resolves with the saved
   * turn. Aborting `signal` stops the reply.
   */
  async streamCoachMessage(
    message: string,
    { onDelta, signal }: { onDelta: (text: string) => void; signal?: AbortSignal }
  ): Promise<CoachTurn> {
    const send = () => fetch(`${this.baseURL}/coach/messages`, {
      method: 'POST',
      headers: this.jsonHeaders(),
      body: JSON.stringify({ message }),
      credentials: 'include',
      signal,
    });

    let response = await send();
    if (isApiAsleep(response)) response = await this.waitForApi(send);
    if (response.status === 401) {
      if (!(await this.refreshSession())) {
        this.sessionExpiredListener?.();
        throw new ApiError('Your session has expired.', 401);
      }
      response = await send();
    }
    if (!response.ok || !response.body || !response.headers.get('Content-Type')?.includes('text/event-stream')) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(data.validationErrors?.[0]?.message || data.error || `HTTP ${response.status}`, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const event = /^event: (.*)$/m.exec(chunk)?.[1];
        const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] ?? 'null');
        if (event === 'delta') onDelta(data.text);
        else if (event === 'done') return data as CoachTurn;
        else if (event === 'error') throw new ApiError(data.message, 502);
      }
    }
    throw new ApiError('The reply was interrupted. Please try again.', 0);
  }

  // AI features (share the coach's opt-in and daily budget)
  async getWeeklyReview(weekStart: string): Promise<ApiResponse<{ review: WeeklyReview | null }>> {
    return this.request(`/ai/weekly-review?weekStart=${weekStart}`);
  }

  async generateWeeklyReview(weekStart: string): Promise<ApiResponse<{ review: WeeklyReview }>> {
    return this.request('/ai/weekly-review', { method: 'POST', body: JSON.stringify({ weekStart }) });
  }

  async planWeek(weekStart: string, window: { start: string; end: string }): Promise<ApiResponse<{ plan: WeekPlan }>> {
    return this.request('/ai/week-plan', { method: 'POST', body: JSON.stringify({ weekStart, window }) });
  }

  async suggestMilestones(goalId: string): Promise<ApiResponse<{ milestones: SuggestedMilestone[] }>> {
    return this.request(`/ai/goals/${goalId}/milestones`, { method: 'POST' });
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
