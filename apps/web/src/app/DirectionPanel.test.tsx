// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DirectionPanel } from './DirectionPanel';

const props = {
  actorName: 'Odile',
  transcript: 'The night is not yet lost.',
  lineText: 'The night is not yet lost.',
  preparing: false,
  comparisonReady: true,
  onGenerate: vi.fn(),
  onAudition: vi.fn(),
};

afterEach(cleanup);

describe('DirectionPanel', () => {
  it('offers six discrete moods and generates the selected documented tags on request', () => {
    const onGenerate = vi.fn();
    render(<DirectionPanel {...props} onGenerate={onGenerate} />);

    expect(screen.getByText('Choose how to perform the note.')).toBeTruthy();
    expect(screen.getByText('“The night is not yet lost.”')).toBeTruthy();
    const slider = screen.getByRole('slider', { name: 'Mood' }) as HTMLInputElement;
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('5');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('5');
    expect(slider.getAttribute('aria-valuetext')).toBe('🔥 Resolve');
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Set mood Fear' }));
    expect(slider.value).toBe('1');
    expect(slider.getAttribute('aria-valuetext')).toBe('😟 Fear');
    expect(screen.getByText('Uneasy and alert')).toBeTruthy();
    expect(screen.queryByText('emotion:fear')).toBeNull();
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Prepare new take' }));
    expect(onGenerate).toHaveBeenCalledWith(['emotion:fear'], 'The night is not yet lost.');
  });

  it('supports keyboard range changes and edited text without preparing until requested', () => {
    const onGenerate = vi.fn();
    render(<DirectionPanel {...props} onGenerate={onGenerate} />);
    const slider = screen.getByRole('slider', { name: 'Mood' }) as HTMLInputElement;
    const text = screen.getByRole('textbox', { name: 'Spoken line' });

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    // Simulate the input event a browser emits after changing a native range by keyboard.
    fireEvent.change(slider, { target: { value: '4' } });
    expect(slider.value).toBe('4');
    expect(slider.getAttribute('aria-valuetext')).toBe('🙂 Relief');
    expect(onGenerate).not.toHaveBeenCalled();

    fireEvent.change(text, { target: { value: '  The harbor lights return.  ' } });
    expect(onGenerate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare new take' }));
    expect(onGenerate).toHaveBeenCalledWith(['emotion:relief'], 'The harbor lights return.');
  });

  it('auditions saved takes without preparing and disables the editor while preparing', () => {
    const onGenerate = vi.fn();
    const onAudition = vi.fn();
    const { rerender } = render(
      <DirectionPanel {...props} onGenerate={onGenerate} onAudition={onAudition} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play original' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play new take' }));
    expect(onAudition.mock.calls).toEqual([['original'], ['directed']]);
    expect(onGenerate).not.toHaveBeenCalled();

    rerender(
      <DirectionPanel {...props} preparing onGenerate={onGenerate} onAudition={onAudition} />,
    );
    expect(screen.getByRole('status').textContent).toContain('Preparing voice and face…');
    expect(
      (screen.getByRole('button', { name: 'Prepare new take' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Play original' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Play new take' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('slider', { name: 'Mood' }) as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole('textbox', { name: 'Spoken line' }) as HTMLTextAreaElement).disabled,
    ).toBe(true);
  });

  it('synchronizes edited text when the held chapter line changes and caps input at 220 characters', () => {
    const { rerender } = render(<DirectionPanel {...props} />);
    const textarea = screen.getByRole('textbox', { name: 'Spoken line' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Local edit' } });
    rerender(<DirectionPanel {...props} lineText="A different chapter line." />);
    expect(textarea.value).toBe('A different chapter line.');
    expect(textarea.maxLength).toBe(220);
  });
});
