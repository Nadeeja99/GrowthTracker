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
});
