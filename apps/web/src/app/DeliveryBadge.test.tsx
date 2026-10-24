// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DeliveryBadge } from './DeliveryBadge';
afterEach(cleanup);
describe('DeliveryBadge', () => {
  it('keeps readable delivery separate from its on-demand raw tags', () => {
    render(
      <DeliveryBadge
        tags={['emotion:determination', 'prosody:expressive_high']}
        text="Hold the light."
      />,
    );
    const summary = screen.getByLabelText('Delivery: Resolve · Expressive');
    expect(summary.textContent).not.toContain('<|');
    fireEvent.click(summary);
    expect(summary.closest('details')?.open).toBe(true);
    expect(screen.getByText('<|emotion:determination|>')).toBeTruthy();
  });
  it('omits unverified metadata rather than presenting a guessed emotion', () => {
    const { container } = render(<DeliveryBadge text="Hold the light." />);
    expect(container.textContent).toBe('');
  });
  it('recognizes documented inline tags but never displays arbitrary control text', () => {
    render(<DeliveryBadge text="<|style:whispering|><|made:up|>Hold the light." />);
    expect(screen.getByLabelText('Delivery: Whispered')).toBeTruthy();
    expect(screen.queryByText('<|made:up|>')).toBeNull();
  });
});
