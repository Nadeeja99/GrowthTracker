import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SlipRiskNote } from './SlipRiskNote'

afterEach(cleanup)

describe('SlipRiskNote', () => {
  it('names the risk and its reasons in words, not colour alone', () => {
    render(<SlipRiskNote risk={{ likelyToSlip: true, reasons: ['You often miss evening blocks', 'Planned 3 days ahead'] }} />)
    expect(screen.getByText('Likely to slip')).toBeTruthy()
    expect(document.body.textContent).toContain('Likely to slip: You often miss evening blocks; Planned 3 days ahead')
  })

  it('works without reasons', () => {
    render(<SlipRiskNote risk={{ likelyToSlip: true, reasons: [] }} />)
    expect(document.body.textContent).toBe('Likely to slip')
  })

  it('shows nothing for a block that is not at risk, or with no risk yet', () => {
    const { container, rerender } = render(<SlipRiskNote risk={{ likelyToSlip: false, reasons: [] }} />)
    expect(container.innerHTML).toBe('')
    rerender(<SlipRiskNote risk={null} />)
    expect(container.innerHTML).toBe('')
  })
})
