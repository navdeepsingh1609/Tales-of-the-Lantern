// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StudioLantern } from './StudioLantern';

afterEach(cleanup);

describe('StudioLantern', () => {
  it('is a focusable button that toggles its light state on keyboard activation', () => {
    render(<StudioLantern />);
    const lantern = screen.getByRole('button', { name: 'Light the lantern' });

    expect(lantern.tagName).toBe('BUTTON');
    expect((lantern as HTMLButtonElement).tabIndex).toBe(0);
    lantern.focus();
    expect(document.activeElement).toBe(lantern);

    // Native buttons synthesize click activation from Enter and Space key presses.
    fireEvent.keyDown(lantern, { key: 'Enter' });
    fireEvent.click(lantern, { detail: 0 });
    fireEvent.keyUp(lantern, { key: 'Enter' });

    expect(
      screen.getByRole('button', { name: 'Dim the lantern' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});
