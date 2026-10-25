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
