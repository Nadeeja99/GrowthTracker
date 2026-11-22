import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient, EstimateParams, EstimateResult } from '@/lib/api';
import { EstimateSuggestion } from './EstimateSuggestion';
import { parseEstimate, TaskForm } from './TaskForm';
import type { Goal, Task } from '@/types';

const params: EstimateParams = { minutes: 60, priority: 'MEDIUM', subtasks: 0, hasDueDate: false, goalId: 'g1' };
const result = (estimate: Partial<NonNullable<EstimateResult['estimate']>> | null, timedTasks = 10): EstimateResult => ({
  estimate: estimate && {
    minutes: 60, suggestedMinutes: 85, lowMinutes: 70, highMinutes: 110, ratio: 1.42, coverage: 0.8,
    basedOn: { tasks: 10, goalTasks: 4 }, ...estimate,
  },
  timedTasks, minHistory: 3, modelVersion: '1.0.0',
});
const respond = (data: EstimateResult) => vi.spyOn(apiClient, 'getEstimate').mockResolvedValue({ success: true, data });

const withQuery = (ui: React.ReactNode) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('EstimateSuggestion', () => {
  it('suggests how long the task usually takes, with the range and what it is based on', async () => {
    respond(result({}));
    const onUse = vi.fn();
    render(withQuery(<EstimateSuggestion params={params} onUse={onUse} />));

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Tasks like this usually take you about 1h 25m');
    expect(status.textContent).toContain('8 in 10 take between 1h 10m and 1h 50m');
    expect(status.textContent).toContain('Based on your last 10 finished timed tasks, 4 for this goal.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use 1h 25m' })).toHaveProperty('disabled', false));
    fireEvent.click(screen.getByRole('button', { name: 'Use 1h 25m' }));
    expect(onUse).toHaveBeenCalledWith(85);
    expect(apiClient.getEstimate).toHaveBeenCalledWith(params, expect.anything());
  });

  it('says the estimate looks right when the suggestion is close', async () => {
    respond(result({ suggestedMinutes: 65, basedOn: { tasks: 5, goalTasks: 0 } }));
    render(withQuery(<EstimateSuggestion params={params} onUse={vi.fn()} />));

    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('That matches how long tasks like this usually take you.');
    expect(status.textContent).toContain('Based on your last 5 finished timed tasks.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('explains how to get suggestions before there is enough history', async () => {
    respond(result(null, 1));
    render(withQuery(<EstimateSuggestion params={params} onUse={vi.fn()} />));
    expect((await screen.findByRole('status')).textContent).toContain('Finish 2 more timed tasks');
  });

  it('shows nothing without a valid estimate, and asks nothing', async () => {
    const spy = respond(result({}));
    render(withQuery(<EstimateSuggestion params={null} onUse={vi.fn()} />));
    await new Promise(r => setTimeout(r, 500));
    expect(screen.queryByRole('status')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('stays hidden when the request fails', async () => {
    const spy = vi.spyOn(apiClient, 'getEstimate').mockRejectedValue(new Error('offline'));
    render(withQuery(<EstimateSuggestion params={params} onUse={vi.fn()} />));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await new Promise(r => setTimeout(r, 50));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('waits for typing to pause before asking', async () => {
    const spy = respond(result({}));
    const client = new QueryClient();
    const at = (p: EstimateParams | null) => <QueryClientProvider client={client}><EstimateSuggestion params={p} onUse={vi.fn()} /></QueryClientProvider>;
    // An empty field, then "6", then "60", typed quickly.
    const { rerender } = render(at(null));
    rerender(at({ ...params, minutes: 6 }));
    rerender(at({ ...params, minutes: 60 }));
    await screen.findByRole('status');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].minutes).toBe(60);
  });
});

describe('parseEstimate', () => {
  it.each([
    ['', null], ['  ', null], ['45', 45], [' 90 ', 90], ['1440', 1440],
    ['0', 'invalid'], ['1441', 'invalid'], ['1.5', 'invalid'], ['-5', 'invalid'], ['soon', 'invalid'],
  ])('%j is %j', (text, expected) => expect(parseEstimate(text)).toBe(expected));
});

describe('TaskForm estimate', () => {
  const goals = [{ id: 'g1', name: 'Ship app', color: '#000' }] as Goal[];
  const existing = { id: 't1', goalId: 'g1', title: 'Write tests', priority: 'medium', status: 'todo', createdAt: '', subtasks: [], tags: [], estimatedTime: 45 } as Task;

  function renderForm(task: Task | null, onSubmit = vi.fn()) {
    respond(result(null, 0));
    render(withQuery(<TaskForm goals={goals} task={task} onSubmit={onSubmit} onCancel={vi.fn()} isMobile={false} />));
    return onSubmit;
  }
  const estimateBox = () => screen.getByLabelText('Estimate in minutes (Optional)');
  const save = () => fireEvent.submit(estimateBox().closest('form')!);

  it('saves the estimate in minutes', () => {
    const onSubmit = renderForm(null);
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Plan sprint' } });
    fireEvent.change(estimateBox(), { target: { value: '30' } });
    save();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Plan sprint', estimatedTime: 30 }));
  });

  it('leaves the estimate out of a new task when empty', () => {
    const onSubmit = renderForm(null);
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Plan sprint' } });
    save();
    expect(onSubmit.mock.calls[0][0].estimatedTime).toBeUndefined();
  });

  it('clears an existing estimate when emptied', () => {
    const onSubmit = renderForm(existing);
    expect(estimateBox()).toHaveProperty('value', '45');
    fireEvent.change(estimateBox(), { target: { value: '' } });
    save();
    expect(onSubmit.mock.calls[0][0].estimatedTime).toBeNull();
  });

  it('explains an invalid estimate and does not save', () => {
    const onSubmit = renderForm(existing);
    fireEvent.change(estimateBox(), { target: { value: '2.5' } });
    save();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter whole minutes, from 1 to 1440').id).toBe('task-estimate-error');
    expect(estimateBox().getAttribute('aria-invalid')).toBe('true');
  });

  it('asks about the task as it stands, leaving the task itself out of its history', async () => {
    renderForm(existing);
    await waitFor(() => expect(apiClient.getEstimate).toHaveBeenCalled());
    expect(vi.mocked(apiClient.getEstimate).mock.calls[0][0]).toEqual({
      minutes: 45, priority: 'MEDIUM', subtasks: 0, hasDueDate: false, goalId: 'g1', excludeTaskId: 't1',
    });
  });
});
