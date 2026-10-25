import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './api';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// A Response body can only be read once, so build a fresh one per use.
const refreshed = () => json(200, { success: true, data: { accessToken: 'new-token', user: { id: 'u1' } } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  apiClient.setToken('expired-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  apiClient.onSessionExpired(null);
});

describe('API client session handling', () => {
  it('silently refreshes an expired access token and replays the request', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { success: false, error: 'Token expired.' }))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(json(200, { success: true, data: { goals: [] } }));
    const res = await apiClient.getGoals();
    expect(res.data?.goals).toEqual([]);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/refresh$/);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token');
  });

  it('shares one refresh between concurrent requests', async () => {
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return refreshed();
      const authHeader = (init.headers as Record<string, string>).Authorization;
      return authHeader === 'Bearer new-token' ? json(200, { success: true, data: {} }) : json(401, { success: false, error: 'expired' });
    });
    await Promise.all([apiClient.getGoals(), apiClient.getTasks(), apiClient.getHabits()]);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('ends the session only when the refresh itself is rejected (401)', async () => {
    const expired = vi.fn();
    apiClient.onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { success: false, error: 'Token expired.' }))
      .mockResolvedValueOnce(json(401, { success: false, error: 'Session expired' }));
    await expect(apiClient.getGoals()).rejects.toBeInstanceOf(ApiError);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does NOT sign out when the refresh is rate-limited or the server errors', async () => {
    const expired = vi.fn();
    apiClient.onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { success: false, error: 'Token expired.' }))
      .mockResolvedValueOnce(json(429, { success: false, error: 'Too many requests' }));
    await expect(apiClient.getGoals()).rejects.toMatchObject({ status: 429 });
    expect(expired).not.toHaveBeenCalled();
  });

  it('surfaces the first field-level validation message', async () => {
    fetchMock.mockResolvedValueOnce(json(400, { success: false, error: 'Validation failed', validationErrors: [{ field: 'title', message: 'Title is required' }] }));
    await expect(apiClient.createGoal({ title: '' })).rejects.toMatchObject({ message: 'Title is required', status: 400 });
  });
});
