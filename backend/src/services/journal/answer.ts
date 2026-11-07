// Prompt for answering from the journal, and the check on what comes back.
import { dataBlock } from '../ai/data';
import { DateRange } from './dateRange';
import { JournalNote } from './search';

export function journalInstructions(input: { today: string; totalNotes: number; range: DateRange | null; notes: JournalNote[] }): string {
  return `You answer one person's questions about their own private journal, inside a personal planning app. The notes below are what they wrote in their daily reviews, with their scores out of 5.

How to answer:
- Use only these notes. Never add facts, causes or advice that aren't in them. If they don't answer the question, say you couldn't find that in the journal, and stop.
- After each claim, cite the note it came from as its date in square brackets, like [2026-03-14]. Cite only dates that appear in the notes, one date per bracket.
- You can see only the most relevant ${input.notes.length} of ${input.totalNotes} notes, so never state a total or say "always" or "never". Say "in the notes I found" instead.
- Be brief: at most about 120 words. Write plain text, with short paragraphs and "- " bullet lists. No headings, tables, links or emoji.
- Speak to the person as "you". Be warm and honest, and don't judge what they wrote.
- If something suggests they may be in crisis or thinking of harming themselves, respond with care and encourage them to reach out to someone they trust or a local crisis line.

${dataBlock(input)}`;
}

const CITATION = /[ \t]*\[(\d{4}-\d{2}-\d{2}(?:\s*,\s*\d{4}-\d{2}-\d{2})*)\]/g;

/**
 * Keeps only citations of notes the model was actually given, so a made-up
 * date can never appear as a source. Returns the cited notes, newest first.
 */
export function resolveCitations(text: string, notes: JournalNote[]): { answer: string; sources: JournalNote[] } {
  const known = new Set(notes.map(note => note.date));
  const cited = new Set<string>();
  const answer = text.replace(CITATION, (_match, list: string) => {
    const dates = list.split(',').map(date => date.trim()).filter(date => known.has(date));
    dates.forEach(date => cited.add(date));
    return dates.map(date => ` [${date}]`).join('');
  }).trim();
  return { answer, sources: notes.filter(note => cited.has(note.date)).sort((a, b) => b.date.localeCompare(a.date)) };
}
