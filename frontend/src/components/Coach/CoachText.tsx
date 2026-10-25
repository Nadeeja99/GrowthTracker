import React from 'react';

const BULLET = /^\s*[-*•]\s+/;

// **bold** only; everything else is plain text (React escapes it).
function inline(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/**
 * Renders the coach's plain-text replies: paragraphs separated by blank lines
 * and "- " bullet lists. No HTML or Markdown beyond that is interpreted.
 */
export function CoachText({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  text.split(/\n\s*\n/).forEach((block, b) => {
    let bullets: string[] = [];
    let lines: string[] = [];
    const flush = (key: string) => {
      if (lines.length) blocks.push(<p key={`${key}p`}>{inline(lines.join(' '))}</p>);
      if (bullets.length) {
        blocks.push(
          <ul key={`${key}u`} className="list-disc pl-5 space-y-1">
            {bullets.map((item, i) => <li key={i}>{inline(item)}</li>)}
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
