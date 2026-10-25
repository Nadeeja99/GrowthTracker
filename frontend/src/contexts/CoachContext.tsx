'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { apiClient, ApiError } from '@/lib/api';
import { describeError } from '@/lib/toast';
import { useCoachMutations } from '@/hooks/data/useCoach';

/** A message on its way: the user's text and the reply streamed so far. */
export interface PendingTurn {
  question: string;
  reply: string;
}

interface CoachContextType {
  isOpen: boolean;
  /** Opens the panel, optionally with a message ready to send. */
  open: (draft?: string) => void;
  close: () => void;
  draft: string;
  setDraft: (text: string) => void;
  pending: PendingTurn | null;
  error: string | null;
  send: (text: string) => Promise<void>;
  /** Stops the reply being generated; the question goes back into the input. */
  stop: () => void;
  /** The last finished reply, for screen readers. */
  announcement: string;
}

const CoachContext = createContext<CoachContextType | undefined>(undefined);

// Lives in the app shell, so a reply keeps streaming if the panel is closed
// or the user switches tabs.
export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const { appendTurn, refresh } = useCoachMutations();

  const send = useCallback(async (text: string) => {
    const question = text.trim();
    if (!question || abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setDraft('');
    setAnnouncement('');
    setPending({ question, reply: '' });

    try {
      const turn = await apiClient.streamCoachMessage(question, {
        signal: controller.signal,
        onDelta: delta => setPending(p => p && { ...p, reply: p.reply + delta }),
      });
      appendTurn(turn);
      setAnnouncement(turn.message.content);
    } catch (err) {
      setDraft(question); // nothing was saved, so let the user retry or edit
      if (!controller.signal.aborted) {
        setError(describeError(err));
        // The server may have changed the limits or the opt-in meanwhile.
        if (err instanceof ApiError && [403, 429, 503].includes(err.status)) refresh();
      }
    } finally {
      abortRef.current = null;
      setPending(null);
    }
  }, [appendTurn, refresh]);

  const value: CoachContextType = {
    isOpen,
    open: (nextDraft?: string) => {
      if (nextDraft !== undefined && !abortRef.current) setDraft(nextDraft);
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
    draft,
    setDraft,
    pending,
    error,
    send,
    stop: () => abortRef.current?.abort(),
    announcement,
  };

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoachPanel() {
  const context = useContext(CoachContext);
  if (!context) throw new Error('useCoachPanel must be used within a CoachProvider');
  return context;
}
