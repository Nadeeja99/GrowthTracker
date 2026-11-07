import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CoachText } from './CoachText';

afterEach(cleanup);

describe('CoachText', () => {
  it('renders paragraphs, bullet lists and bold text', () => {
    const { container } = render(<CoachText text={'Good week.\n\n- **AWS**: 6 h\n- Running: 1 h\nKeep going.'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect([...container.querySelectorAll('li')].map(li => li.textContent)).toEqual(['AWS: 6 h', 'Running: 1 h']);
    expect(container.querySelector('strong')?.textContent).toBe('AWS');
  });

  it('never interprets HTML from the model', () => {
    const { container } = render(<CoachText text={'<img src=x onerror=alert(1)> <script>alert(1)</script>'} />);
    expect(container.querySelector('img, script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('renders citations only when asked to, inside paragraphs and bullets', () => {
    const text = 'Tired [2026-03-14].\n\n- **Slept** badly [2026-03-15]';
    const cite = (date: string) => <a href={`#${date}`}>{date.slice(5)}</a>;

    const cited = render(<CoachText text={text} cite={cite} />);
    expect([...cited.container.querySelectorAll('a')].map(a => a.textContent)).toEqual(['03-14', '03-15']);
    expect(cited.container.textContent).not.toContain('[');
    cleanup();

    const plain = render(<CoachText text={text} />);
    expect(plain.container.querySelectorAll('a')).toHaveLength(0);
    expect(plain.container.textContent).toContain('[2026-03-14]');
  });
});
