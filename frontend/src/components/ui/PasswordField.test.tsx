import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { newPasswordProblem, PasswordField } from './PasswordField';

afterEach(cleanup);

describe('new password rules', () => {
  it('asks for 8–128 characters and a matching confirmation', () => {
    expect(newPasswordProblem('short', 'short')).toBe('Use at least 8 characters.');
    expect(newPasswordProblem('x'.repeat(129), 'x'.repeat(129))).toBe('Use at most 128 characters.');
    expect(newPasswordProblem('long-enough', 'long-enougH')).toBe('The two passwords don’t match.');
    expect(newPasswordProblem('long-enough', 'long-enough')).toBeNull();
  });
});

describe('PasswordField', () => {
  function Harness() {
    const [value, setValue] = useState('secret-123');
    return <PasswordField id="pw" label="New password" value={value} onChange={setValue} autoComplete="new-password" hint="At least 8 characters." />;
  }

  it('is labelled, described by its hint, and can be shown and hidden', () => {
    render(<Harness />);
    const input = screen.getByLabelText('New password');
    expect(input).toHaveProperty('type', 'password');
    expect(input.getAttribute('aria-describedby')).toBe('pw-hint');

    const toggle = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(toggle);
    expect(input).toHaveProperty('type', 'text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });
});
