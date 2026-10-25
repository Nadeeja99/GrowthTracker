'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CalendarClock, Check, ListTodo, Repeat, Send, Sparkles, Square, Trash2, X } from 'lucide-react';
import { useCoachPanel } from '@/contexts/CoachContext';
import { useCoach, useCoachMutations } from '@/hooks/data/useCoach';
import { useGoals } from '@/hooks/data/useGoals';
import { useDialog } from '@/hooks/useDialog';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Skeleton } from '@/components/ui/Skeleton';
import { CoachMessage, CoachSuggestion } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { CoachText } from './CoachText';

const MAX_LENGTH = 1000;

export const STARTER_PROMPTS = [
  'Plan my day',
  'How did my week go?',
  'What should I focus on next?',
  'Why do I keep skipping things?',
];

/** What the coach sees, shown before opting in and in Settings. */
export function CoachDataNotice() {
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400">
      <li>Each AI request (coach messages, weekly reviews, week plans, milestone suggestions) sends the relevant goals, tasks, time blocks, habits and recent daily reviews (including notes) to OpenAI.</li>
      <li>Your email address and password are never sent. OpenAI doesn&apos;t use API data to train its models.</li>
      <li>The coach only suggests changes; nothing is added to your plan unless you choose to.</li>
    </ul>
  );
}

const dayLabel = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
const timeLabel = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const PRIORITY = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;
const FREQUENCY = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly' } as const;

function describeSuggestion(s: CoachSuggestion, goalName: (id: string | null) => string | undefined): string {
  if (s.kind === 'time_block') {
    const start = new Date(s.startTime);
    return [`${dayLabel(start)}, ${timeLabel(start)}–${timeLabel(new Date(s.endTime))}`, goalName(s.goalId)].filter(Boolean).join(' · ');
  }
  if (s.kind === 'task') {
    const due = s.dueDate ? `due ${dayLabel(new Date(`${s.dueDate}T00:00:00`))}` : undefined;
    return ['Task', `${PRIORITY[s.priority]} priority`, due, goalName(s.goalId)].filter(Boolean).join(' · ');
  }
  return `${FREQUENCY[s.frequency]} habit`;
}

const KIND = {
  task: { icon: ListTodo, action: 'Add task' },
  time_block: { icon: CalendarClock, action: 'Add to plan' },
  habit: { icon: Repeat, action: 'Add habit' },
} as const;

function SuggestionCard({ messageId, suggestion }: { messageId: string; suggestion: CoachSuggestion }) {
  const { apply } = useCoachMutations();
  const goals = useGoals().data ?? [];
  const goalName = (id: string | null) => goals.find(g => g.id === id)?.name;
  const { icon: Icon, action } = KIND[suggestion.kind];
  const busy = apply.isPending && apply.variables?.suggestionId === suggestion.id;

  return (
    <li className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 flex gap-3">
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{describeSuggestion(suggestion, goalName)}</p>
        {suggestion.reason && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{suggestion.reason}</p>}
      </div>
      {suggestion.appliedId ? (
        <span className="self-center flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <Check className="w-4 h-4" aria-hidden="true" /> Added
        </span>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => apply.mutate(
            { messageId, suggestionId: suggestion.id },
            { onSuccess: () => toast.success(`Added “${suggestion.title}”`) }
          )}
          aria-label={`${action}: ${suggestion.title}`}
          className="self-center flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-60"
        >
          {busy ? 'Adding…' : action}
        </button>
      )}
    </li>
  );
}

function Bubble({ role, children }: { role: CoachMessage['role']; children: React.ReactNode }) {
  return (
    <div className={cn('flex', role === 'user' ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
        role === 'user'
          ? 'bg-blue-600 text-white rounded-br-md whitespace-pre-wrap'
          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
      )}>
        {children}
      </div>
    </div>
  );
}

function Conversation({ messages }: { messages: CoachMessage[] }) {
  const { pending, send } = useCoachPanel();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, pending?.reply]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="py-6">
        <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Ask about your plan</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          The coach reads your goals, blocks, habits and reviews, and can suggest tasks or time blocks you add with one click.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {STARTER_PROMPTS.map(prompt => (
            <button
              key={prompt}
              type="button"
              onClick={() => send(prompt)}
              className="px-3 py-1.5 text-sm rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {messages.map(m => (
        <div key={m.id} className="space-y-2">
          <Bubble role={m.role}>{m.role === 'user' ? m.content : <CoachText text={m.content} />}</Bubble>
          {m.suggestions.length > 0 && (
            <ul aria-label="Suggestions" className="space-y-2">
              {m.suggestions.map(s => <SuggestionCard key={s.id} messageId={m.id} suggestion={s} />)}
            </ul>
          )}
        </div>
      ))}
      {pending && (
        <>
          <Bubble role="user">{pending.question}</Bubble>
          <Bubble role="assistant">
            {pending.reply ? <CoachText text={pending.reply} /> : (
              <span className="flex gap-1 py-1">
                <span className="sr-only">Coach is thinking</span>
                {[0, 1, 2].map(i => <span key={i} aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
              </span>
            )}
          </Bubble>
        </>
      )}
      <div ref={endRef} />
    </div>
  );
}

function Composer({ remaining }: { remaining: number }) {
  const { draft, setDraft, send, stop, pending, error } = useCoachPanel();
  const ref = useRef<HTMLTextAreaElement>(null);
  const outOfMessages = remaining === 0 && !pending;

  // Grow with the text, up to about six lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  const submit = () => {
    if (!pending && draft.trim()) send(draft);
  };

  return (
    <form
      onSubmit={event => { event.preventDefault(); submit(); }}
      className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 bg-gray-50 dark:bg-gray-900"
    >
      {error && <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-end gap-2">
        <label htmlFor="coach-input" className="sr-only">Message the coach</label>
        <textarea
          id="coach-input"
          ref={ref}
          autoFocus
          rows={1}
          value={draft}
          maxLength={MAX_LENGTH}
          disabled={outOfMessages}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={outOfMessages ? 'No AI requests left today' : 'Ask about your goals, week or habits…'}
          className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        {pending ? (
          <button type="button" onClick={stop} aria-label="Stop the reply" className="p-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={!draft.trim() || outOfMessages} aria-label="Send" className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between gap-2">
        <span>{remaining} AI {remaining === 1 ? 'request' : 'requests'} left today · AI can make mistakes</span>
        {draft.length > MAX_LENGTH - 200 && <span className="tabular-nums">{draft.length}/{MAX_LENGTH}</span>}
      </p>
    </form>
  );
}

function OptIn() {
  const { setEnabled } = useCoachMutations();
  return (
    <div className="py-6">
      <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" aria-hidden="true" />
      <h3 className="mt-3 font-semibold text-gray-900 dark:text-white">Meet your AI coach</h3>
      <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
        Get advice grounded in your own plan: what to focus on, where your week is slipping, and blocks or tasks to add.
      </p>
      <CoachDataNotice />
      <button
        type="button"
        disabled={setEnabled.isPending}
        onClick={() => setEnabled.mutate(true)}
        className="mt-5 w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
      >
        {setEnabled.isPending ? 'Turning on…' : 'Turn on AI Coach'}
      </button>
      <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
        You can turn it off any time in <Link href="/settings" className="underline">Settings</Link>.
      </p>
    </div>
  );
}

/** Slide-over chat with the AI coach. */
export function CoachPanel() {
  const { isOpen, close, pending, announcement } = useCoachPanel();
  const coach = useCoach(isOpen);
  const { clear } = useCoachMutations();
  const confirm = useConfirm();
  const dialogRef = useDialog<HTMLDivElement>(close, isOpen);

  if (!isOpen) return null;
  const status = coach.data;
  const canClear = status?.enabled && status.messages.length > 0 && !pending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="coach-panel-title" className="relative w-full sm:max-w-md h-full flex flex-col bg-gray-50 dark:bg-gray-900 shadow-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 id="coach-panel-title" className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Coach
          </h2>
          <div className="flex items-center gap-1">
            {canClear && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({ title: 'Clear the conversation?', message: 'The coach will start fresh. Items you already added stay in your plan.', confirmLabel: 'Clear' });
                  if (ok) clear.mutate();
                }}
                aria-label="Clear conversation"
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close coach"
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6">
          {coach.isLoading && (
            <div role="status" aria-label="Loading the coach" className="py-6 space-y-3">
              <Skeleton className="h-16 w-3/4" />
              <Skeleton className="h-10 w-1/2 ml-auto" />
            </div>
          )}
          {coach.error && !status && (
            <div className="py-6 text-sm text-gray-700 dark:text-gray-300">
              <p role="alert">Couldn’t load the coach.</p>
              <button type="button" onClick={() => coach.refetch()} className="mt-2 text-blue-700 dark:text-blue-300 underline">Try again</button>
            </div>
          )}
          {status && !status.configured && (
            <p className="py-6 text-sm text-gray-700 dark:text-gray-300">
              AI Coach isn’t set up on this server yet. Everything else in GrowthTracker works as usual.
            </p>
          )}
          {status?.configured && !status.enabled && <OptIn />}
          {status?.configured && status.enabled && <Conversation messages={status.messages} />}
        </div>

        {status?.configured && status.enabled && <Composer remaining={status.usage.remaining} />}

        {/* Announce finished replies once, rather than every streamed fragment. */}
        <div className="sr-only" aria-live="polite">{pending ? 'Coach is replying…' : announcement}</div>
      </div>
    </div>
  );
}

/** Header control that opens the coach. */
export function CoachButton() {
  const { open, pending } = useCoachPanel();
  return (
    <button
      type="button"
      onClick={() => open()}
      aria-label={pending ? 'Open AI coach (replying)' : 'Open AI coach'}
      className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Sparkles className="w-5 h-5" />
      {pending && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden="true" />}
    </button>
  );
}
