import React from 'react';

const BULLET = /^\s*[-*•]\s+/;

type Cite = (date: string) => React.ReactNode;

const CITATION = /\[(\d{4}-\d{2}-\d{2})\]/g;

const withCitations = (text: string, cite: Cite) =>
  text.split(CITATION).map((part, i) => <React.Fragment key={i}>{i % 2 ? cite(part) : part}</React.Fragment>);

// **bold** only; everything else is plain text (React escapes it).
function inline(text: string, cite?: Cite): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => {
    if (i % 2) return <strong key={i}>{part}</strong>;
    return cite ? <React.Fragment key={i}>{withCitations(part, cite)}</React.Fragment> : part;
  });
}

/**
 * Renders the coach's plain-text replies: paragraphs separated by blank lines
 * and "- " bullet lists. No HTML or Markdown beyond that is interpreted.
 * `cite` renders [YYYY-MM-DD] citations, for answers drawn from the journal.
 */
export function CoachText({ text, cite }: { text: string; cite?: Cite }) {
  const blocks: React.ReactNode[] = [];
  text.split(/\n\s*\n/).forEach((block, b) => {
    let bullets: string[] = [];
    let lines: string[] = [];
    const flush = (key: string) => {
      if (lines.length) blocks.push(<p key={`${key}p`}>{inline(lines.join(' '), cite)}</p>);
      if (bullets.length) {
        blocks.push(
          <ul key={`${key}u`} className="list-disc pl-5 space-y-1">
            {bullets.map((item, i) => <li key={i}>{inline(item, cite)}</li>)}
          </ul>
        );
      }
      lines = [];
      bullets = [];
    };
    block.split('\n').forEach((line, l) => {
      if (BULLET.test(line)) {
        if (lines.length) flush(`${b}-${l}`);
        bullets.push(line.replace(BULLET, ''));
      } else if (line.trim()) {
        if (bullets.length) flush(`${b}-${l}`);
        lines.push(line.trim());
      }
    });
    flush(`${b}-end`);
  });
  return <div className="space-y-2">{blocks}</div>;
}
