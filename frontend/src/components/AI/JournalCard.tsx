'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search, Sparkles, Square } from 'lucide-react';
import { CoachText } from '@/components/Coach/CoachText';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAiStatus } from '@/hooks/data/useAi';
import { useJournalAnswer, useJournalSearch } from '@/hooks/data/useJournal';
import { JournalNote } from '@/lib/api';
import { parseDateKey } from '@/lib/dates';
import { describeError } from '@/lib/toast';
import { aiButtonClass, TurnOnAiHint } from './AiControls';

const MAX_LENGTH = 300;

const noteId = (date: string) => `journal-note-${date}`;
const dayLabel = (date: string) => parseDateKey(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fullDayLabel = (date: string) =>
  parseDateKey(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function Citation({ date }: { date: string }) {
  return (
    <a
      href={`#${noteId(date)}`}
      aria-label={`Note from ${fullDayLabel(date)}`}
      className="mx-0.5 inline-block rounded px-1.5 text-xs font-medium whitespace-nowrap bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 underline underline-offset-2"
    >
      {dayLabel(date)}
    </a>
  );
}

const cite = (date: string) => <Citation date={date} />;

function Notes({ notes }: { notes: JournalNote[] }) {
  return (
    <ul className="space-y-2">
      {notes.map(note => {
        const scores = [['Performance', note.performance], ['Energy', note.energy], ['Mood', note.mood]].filter(([, score]) => score != null);
        return (
          <li key={note.date} id={noteId(note.date)} className="scroll-mt-24 rounded-lg border border-gray-200 dark:border-gray-700 p-3 target:border-blue-500 dark:target:border-blue-400">
            <time dateTime={note.date} className="text-xs font-medium text-gray-600 dark:text-gray-400">{fullDayLabel(note.date)}</time>
            <p className="mt-1 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-line break-words">{note.notes}</p>
            {scores.length > 0 && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {scores.map(([label, score]) => `${label} ${score}/5`).join(' · ')}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Search and questions over daily review notes, on the Insights page. */
export function JournalCard({ hasNotes }: { hasNotes: boolean }) {
  const ai = useAiStatus();
  const search = useJournalSearch();
  const { state: answer, ask, reset } = useJournalAnswer();
  const [text, setText] = useState('');
  const [searched, setSearched] = useState('');

  const canAsk = ai.configured && ai.enabled;
  const asking = answer.status === 'asking';
  const value = text.trim();

  const runSearch = () => {
    if (!value) return;
    reset();
    setSearched(value);
    search.mutate(value);
  };

  const runAsk = () => {
    if (!value || asking) return;
    search.reset();
    ask(value);
  };

  return (
    <section aria-labelledby="journal-title" className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 md:p-6">
      <h2 id="journal-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Your journal
      </h2>

      {hasNotes ? (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {canAsk ? 'Search the notes from your daily reviews, or ask a question about them.' : 'Search the notes from your daily reviews.'}
        </p>
      ) : (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Notes you add to a <Link href="/today" className="font-medium text-blue-700 dark:text-blue-300 underline">daily review</Link> will be searchable here.
        </p>
      )}

      <form
        className="mt-3 flex flex-col sm:flex-row gap-2"
        onSubmit={event => {
          event.preventDefault();
          if (canAsk) runAsk();
          else runSearch();
        }}
      >
        <input
          type="text"
          value={text}
          onChange={event => setText(event.target.value)}
          maxLength={MAX_LENGTH}
          aria-label={canAsk ? 'Search or ask your journal' : 'Search your journal'}
          placeholder={canAsk ? 'When did I feel most tired?' : 'Search your notes'}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
        />
        <div className="flex gap-2">
          {canAsk && (asking ? (
            <button type="button" onClick={reset} className={aiButtonClass}>
              <Square className="w-4 h-4" aria-hidden="true" /> Stop
            </button>
          ) : (
            <button type="submit" disabled={!value} className={aiButtonClass}>
              <Sparkles className="w-4 h-4" aria-hidden="true" /> Ask
            </button>
          ))}
          <button
            type={canAsk ? 'button' : 'submit'}
            onClick={canAsk ? runSearch : undefined}
            disabled={!value || search.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium disabled:opacity-50"
          >
            <Search className="w-4 h-4" aria-hidden="true" /> Search
          </button>
        </div>
      </form>

      {ai.configured && !ai.enabled && (
        <div className="mt-3">
          <TurnOnAiHint>Ask questions and get answers drawn from your own notes.</TurnOnAiHint>
        </div>
      )}

      {answer.status === 'asking' && (
        <div className="mt-4 text-sm text-gray-800 dark:text-gray-200">
          {answer.text ? <CoachText text={answer.text} cite={cite} /> : (
            <div role="status" className="space-y-2">
              <p className="text-gray-600 dark:text-gray-400">Reading your journal…</p>
              <Skeleton className="h-5 w-3/4" />
            </div>
          )}
        </div>
      )}

      {answer.status === 'done' && (
        <div className="mt-4 space-y-3">
          <div role="status" className="text-sm text-gray-800 dark:text-gray-200">
            <CoachText text={answer.result.answer} cite={cite} />
          </div>
          {answer.result.method === 'keywords' && (
            <p className="text-xs text-gray-600 dark:text-gray-400">Only exact words were searched this time, so a note written differently may have been missed.</p>
          )}
          {answer.result.sources.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-white">From your notes</h3>
              <Notes notes={answer.result.sources} />
            </div>
          )}
        </div>
      )}

      {answer.status === 'error' && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{answer.message}</p>}

      {search.isPending && <p role="status" className="mt-4 text-sm text-gray-600 dark:text-gray-400">Searching…</p>}
      {search.isError && <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">{describeError(search.error)}</p>}
      {search.isSuccess && (
        <div className="mt-4 space-y-2">
          <p role="status" className="text-sm text-gray-600 dark:text-gray-400">
            {search.data.length === 0 ? `No notes match “${searched}”.` : `${search.data.length === 1 ? '1 note' : `${search.data.length} notes`} found`}
          </p>
          <Notes notes={search.data} />
        </div>
      )}
    </section>
  );
}
