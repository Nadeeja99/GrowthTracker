import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiClient, JournalAnswer, StreamOptions } from '@/lib/api';
import { JournalCard } from './JournalCard';

const aiStatus = vi.hoisted(() => ({ configured: true, enabled: true, remaining: 10 }));
vi.mock('@/hooks/data/useAi', () => ({ useAiStatus: () => aiStatus }));
vi.mock('@/contexts/CoachContext', () => ({ useCoachPanel: () => ({ open: vi.fn() }) }));

const note = (date: string, notes: string) => ({ date, notes, performance: 3, energy: 2, mood: null });
const usage = { used: 1, limit: 20, remaining: 19 };

function renderCard(hasNotes = true) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JournalCard hasNotes={hasNotes} />
    </QueryClientProvider>
  );
}

const type = (text: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

/** Types into the box and presses Enter. */
const submit = (text: string) => {
  type(text);
  fireEvent.submit(screen.getByRole('textbox').closest('form')!);
};

beforeEach(() => Object.assign(aiStatus, { configured: true, enabled: true }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('asking', () => {
  it('turns citations into links to the notes behind them', async () => {
    const result: JournalAnswer = { answer: 'You felt tired [2026-03-14].', sources: [note('2026-03-14', 'Exhausted.')], method: 'hybrid', usage };
    vi.spyOn(apiClient, 'askJournal').mockResolvedValue(result);
    renderCard();

    submit('When was I tired?');

    const link = await screen.findByRole('link', { name: /Note from/ });
    expect(link.getAttribute('href')).toBe('#journal-note-2026-03-14');
    expect(document.getElementById('journal-note-2026-03-14')?.textContent).toContain('Exhausted.');
    expect(screen.getByText(/Performance 3\/5 · Energy 2\/5/)).toBeTruthy();
    expect(link.closest('p')?.textContent).not.toContain('[2026');
  });

  it('shows the answer as it arrives', async () => {
    let options!: StreamOptions;
    vi.spyOn(apiClient, 'askJournal').mockImplementation((_q, o) => {
      options = o;
      return new Promise(() => {});
    });
    renderCard();
    submit('How was I?');
    expect(await screen.findByText('Reading your journal…')).toBeTruthy();

    options.onDelta('You felt ');
    options.onDelta('fine.');

    expect(await screen.findByText('You felt fine.')).toBeTruthy();
  });

  it('stops without showing an error, and can ask again', async () => {
    const ask = vi.spyOn(apiClient, 'askJournal').mockImplementation((_q, { signal }) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    renderCard();
    submit('How was I?');

    fireEvent.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => expect(screen.queryByText('Reading your journal…')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeTruthy();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('shows a failure in place', async () => {
    vi.spyOn(apiClient, 'askJournal').mockRejectedValue(new TypeError('Failed to fetch'));
    renderCard();

    submit('How was I?');

    expect((await screen.findByRole('alert')).textContent).toMatch(/offline/);
  });

  it('warns when only exact words were searched', async () => {
    vi.spyOn(apiClient, 'askJournal').mockResolvedValue({ answer: 'Nothing found.', sources: [], method: 'keywords', usage });
    renderCard();

    submit('How was I?');

    expect(await screen.findByText(/Only exact words were searched/)).toBeTruthy();
    expect(screen.queryByText('From your notes')).toBeNull();
  });
});

describe('searching', () => {
  it('lists matching notes without using AI', async () => {
    Object.assign(aiStatus, { enabled: false });
    const ask = vi.spyOn(apiClient, 'askJournal');
    vi.spyOn(apiClient, 'searchJournal').mockResolvedValue({ success: true, data: { notes: [note('2026-03-14', 'Saw the physio.')] } });
    renderCard();

    submit('physio');

    expect(await screen.findByText('Saw the physio.')).toBeTruthy();
    expect(screen.getByText('1 note found')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask' })).toBeNull();
    expect(ask).not.toHaveBeenCalled();
  });

  it('says when nothing matches', async () => {
    vi.spyOn(apiClient, 'searchJournal').mockResolvedValue({ success: true, data: { notes: [] } });
    renderCard();
    type('zebra');

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText('No notes match “zebra”.')).toBeTruthy();
  });

  it('replaces an answer with search results', async () => {
    vi.spyOn(apiClient, 'askJournal').mockResolvedValue({ answer: 'An answer.', sources: [], method: 'hybrid', usage });
    vi.spyOn(apiClient, 'searchJournal').mockResolvedValue({ success: true, data: { notes: [] } });
    renderCard();
    submit('zebra');
    await screen.findByText('An answer.');

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    await screen.findByText(/No notes match/);
    expect(screen.queryByText('An answer.')).toBeNull();
  });
});

describe('before there’s anything to use', () => {
  it('points to the daily review when there are no notes', () => {
    renderCard(false);
    expect(screen.getByRole('link', { name: 'daily review' }).getAttribute('href')).toBe('/today');
  });

  it('offers the coach when AI is off, and search only when the server has no AI', () => {
    Object.assign(aiStatus, { enabled: false });
    renderCard();
    expect(screen.getByRole('button', { name: 'Turn on the AI Coach' })).toBeTruthy();
    cleanup();

    Object.assign(aiStatus, { configured: false });
    renderCard();
    expect(screen.queryByRole('button', { name: 'Turn on the AI Coach' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy();
  });

  it('won’t submit an empty box', () => {
    renderCard();
    expect((screen.getByRole('button', { name: 'Ask' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Search' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
