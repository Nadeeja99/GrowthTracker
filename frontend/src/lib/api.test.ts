import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './api';

// Read when api.ts loads, so set it before the import above runs.
const WAKE_URL = vi.hoisted(() => (process.env.NEXT_PUBLIC_API_WAKE_URL = 'https://api.test/health'));

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

  it('treats "no refresh cookie" as signed out, without an error', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { success: true, data: null }));
    await expect(apiClient.refreshSession()).resolves.toBeNull();
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

describe('waking a stopped API', () => {
  // What Render sends while the API is stopped: its own HTML page, not API JSON.
  const hostError = () => new Response('<!DOCTYPE html><title>502</title>', { status: 502, headers: { 'Content-Type': 'text/html' } });
  const urls = () => fetchMock.mock.calls.map(([url]) => url);

  // The client is shared between tests and reuses a ping for 90 s, so give
  // each test a clock far past the previous one.
  let now = 0;
  beforeEach(() => {
    now += 10 * 60_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => vi.restoreAllMocks());

  it('reuses the ping sent when the app opened, then retries the request', async () => {
    let goalsCalls = 0;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === WAKE_URL) return json(200, { status: 'OK' });
      return ++goalsCalls === 1 ? hostError() : json(200, { success: true, data: { goals: [] } });
    });
    apiClient.wakeApi();
    const res = await apiClient.getGoals();
    expect(res.data?.goals).toEqual([]);
    expect(urls()).toEqual([WAKE_URL, '/api/goals?limit=500', '/api/goals?limit=500']);
  });

  it('sends one ping for requests that fail together', async () => {
    const failedOnce = new Set<string>();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === WAKE_URL) return json(200, { status: 'OK' });
      if (!failedOnce.has(url)) {
        failedOnce.add(url);
        return hostError();
      }
      return json(200, { success: true, data: {} });
    });
    await Promise.all([apiClient.getGoals(), apiClient.getTasks()]);
    expect(urls().filter(url => url === WAKE_URL)).toHaveLength(1);
  });

  it('gives up at once, with a readable message, when the ping is blocked', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === WAKE_URL) throw new TypeError('Failed to fetch');
      return hostError();
    });
    await expect(apiClient.getGoals()).rejects.toMatchObject({ message: expect.stringMatching(/still starting/), status: 502 });
    expect(urls()).toEqual(['/api/goals?limit=500', WAKE_URL]);
  });

  it('does not resend after one of the API’s own 502 errors', async () => {
    fetchMock.mockResolvedValueOnce(json(502, { success: false, error: 'The AI service is busy' }));
    await expect(apiClient.getGoals()).rejects.toMatchObject({ message: 'The AI service is busy', status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('coach streaming', () => {
  const sse = (chunks: string[], status = 200) => new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        chunks.forEach(c => controller.enqueue(encoder.encode(c)));
        controller.close();
      },
    }),
    { status, headers: { 'Content-Type': 'text/event-stream' } }
  );
  const turn = { userMessage: { id: 'u' }, message: { id: 'a', content: 'Hi there' }, usage: { used: 1, limit: 20, remaining: 19 } };

  it('reassembles events split across network chunks', async () => {
    const body = `event: delta\ndata: {"text":"Hi "}\n\nevent: delta\ndata: {"text":"there"}\n\nevent: done\ndata: ${JSON.stringify(turn)}\n\n`;
    fetchMock.mockResolvedValueOnce(sse([body.slice(0, 7), body.slice(7, 40), body.slice(40)]));
    const deltas: string[] = [];
    const result = await apiClient.streamCoachMessage('Hello', { onDelta: d => deltas.push(d) });
    expect(deltas).toEqual(['Hi ', 'there']);
    expect(result).toEqual(turn);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'Hello' });
  });

  it('turns an error event into an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(sse(['event: error\ndata: {"message":"The AI service is busy"}\n\n']));
    await expect(apiClient.streamCoachMessage('Hello', { onDelta: () => {} })).rejects.toMatchObject({ message: 'The AI service is busy' });
  });

  it('reports JSON errors sent before streaming (e.g. the daily cap)', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { success: false, error: 'You’ve used all 20 coach messages for today.' }));
    await expect(apiClient.streamCoachMessage('Hello', { onDelta: () => {} })).rejects.toMatchObject({ status: 429 });
  });

  it('refreshes an expired session once, then streams', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { success: false, error: 'Token expired.' }))
      .mockResolvedValueOnce(refreshed())
      .mockResolvedValueOnce(sse([`event: done\ndata: ${JSON.stringify(turn)}\n\n`]));
    await expect(apiClient.streamCoachMessage('Hello', { onDelta: () => {} })).resolves.toEqual(turn);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer new-token');
  });

  it('treats a stream that ends without a result as interrupted', async () => {
    fetchMock.mockResolvedValueOnce(sse(['event: delta\ndata: {"text":"Hal"}\n\n']));
    await expect(apiClient.streamCoachMessage('Hello', { onDelta: () => {} })).rejects.toThrow(/interrupted/);
  });
});
