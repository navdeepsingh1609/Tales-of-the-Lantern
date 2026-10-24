// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoryParticipation } from './StoryParticipation';

afterEach(cleanup);

const openWritePopover = (container: HTMLElement) => {
  const summary = container.querySelector('.story-write > summary');
  expect(summary?.getAttribute('aria-label')).toBe('Write a reply');
  fireEvent.click(summary!);
};

const makeProps = (overrides: Partial<React.ComponentProps<typeof StoryParticipation>> = {}) => ({
  status: 'idle' as const,
  level: 0,
  transcript: '',
  error: '',
  onMic: vi.fn(),
  onTypedTurn: vi.fn(),
  onCancel: vi.fn(),
  ...overrides,
});

describe('StoryParticipation', () => {
  it('allows a new contribution to interrupt speculative preparation', () => {
    const props = makeProps({ status: 'rendering', canInterrupt: true });
    const { container } = render(<StoryParticipation {...props} />);
    const join = screen.getByRole('button', { name: 'Join the conversation' }) as HTMLButtonElement;
    expect(join.disabled).toBe(false);
    fireEvent.click(join);
    expect(props.onMic).toHaveBeenCalledOnce();
    openWritePopover(container);
    fireEvent.change(screen.getByRole('textbox', { name: 'Write a reply' }), {
      target: { value: 'Change the plan.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(props.onTypedTurn).toHaveBeenCalledWith('Change the plan.');
  });
  it('calls voice and typed-turn callbacks only after explicit actions', () => {
    const onMic = vi.fn();
    const onTypedTurn = vi.fn();
    const { container } = render(
      <StoryParticipation {...makeProps({ level: 0.37, onMic, onTypedTurn })} />,
    );

    const group = screen.getByRole('group', { name: 'Join the conversation' });
    const meter = screen.getByRole('meter', { name: 'Microphone level' });
    expect(meter.getAttribute('aria-valuenow')).toBe('37');
    const joinButton = screen.getByRole('button', { name: 'Join the conversation' });
    expect(meter.contains(joinButton)).toBe(false);
    expect(group.contains(joinButton)).toBe(true);
    expect(screen.getByText('Join in')).toBeTruthy();
    expect(onMic).not.toHaveBeenCalled();
    expect(onTypedTurn).not.toHaveBeenCalled();

    fireEvent.click(joinButton);
    expect(onMic).toHaveBeenCalledTimes(1);

    openWritePopover(container);
    const textbox = screen.getByRole('textbox', { name: 'Write a reply' }) as HTMLTextAreaElement;
    expect(textbox.maxLength).toBe(500);
    fireEvent.change(textbox, { target: { value: 'The road turns east.' } });
    expect(onTypedTurn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onTypedTurn).toHaveBeenCalledWith('The road turns east.');
  });

  it('sends a selected conversation starter once and closes the popover', () => {
    const onMic = vi.fn();
    const onTypedTurn = vi.fn();
    const { container } = render(
      <StoryParticipation
        {...makeProps({ onMic, onTypedTurn, starters: ['Ask about the lantern.', 'Offer help.'] })}
      />,
    );
    expect(onMic).not.toHaveBeenCalled();
    expect(onTypedTurn).not.toHaveBeenCalled();
    openWritePopover(container);
    expect(screen.getByText('Try a line')).toBeTruthy();
    expect(screen.getByText('Starts a new cast response')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ask about the lantern.' }));
    expect(onTypedTurn).toHaveBeenCalledTimes(1);
    expect(onTypedTurn).toHaveBeenCalledWith('Ask about the lantern.');
    expect(onMic).not.toHaveBeenCalled();
    expect(container.querySelector('.story-write')?.hasAttribute('open')).toBe(false);
  });

  it.each([
    { label: 'disabled', disabled: true },
    { label: 'busy', status: 'rendering' as const },
    { label: 'listening', status: 'listening' as const },
  ])('disables starter selection while $label', ({ ...state }) => {
    const onTypedTurn = vi.fn();
    const { container } = render(
      <StoryParticipation
        {...makeProps({ ...state, starters: ['Ask what changed.'], onTypedTurn })}
      />,
    );
    openWritePopover(container);
    const starter = screen.getByRole('button', { name: 'Ask what changed.' }) as HTMLButtonElement;
    expect(starter.disabled).toBe(true);
    fireEvent.click(starter);
    expect(onTypedTurn).not.toHaveBeenCalled();
  });

  it('allows a starter to interrupt background rendering when canInterrupt is true', () => {
    const onTypedTurn = vi.fn();
    const { container } = render(
      <StoryParticipation
        {...makeProps({
          status: 'rendering',
          canInterrupt: true,
          starters: ['Change the scene.'],
          onTypedTurn,
        })}
      />,
    );
    openWritePopover(container);
    const starter = screen.getByRole('button', { name: 'Change the scene.' }) as HTMLButtonElement;
    expect(starter.disabled).toBe(false);
    fireEvent.click(starter);
    expect(onTypedTurn).toHaveBeenCalledTimes(1);
    expect(onTypedTurn).toHaveBeenCalledWith('Change the scene.');
  });

  it('shows a stop-listening action and the live transcript while listening', () => {
    const onMic = vi.fn();
    const { container } = render(
      <StoryParticipation
        {...makeProps({ status: 'listening', level: 0.82, transcript: 'I will go on.', onMic })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Stop listening' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('I will go on.');
    openWritePopover(container);
    expect(
      (screen.getByRole('textbox', { name: 'Write a reply' }) as HTMLTextAreaElement).value,
    ).toBe('I will go on.');
    expect(
      (screen.getByRole('textbox', { name: 'Write a reply' }) as HTMLTextAreaElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop listening' }));
    expect(onMic).toHaveBeenCalledTimes(1);
  });

  it('disables join and typed reply while busy and offers explicit cancel', () => {
    const onMic = vi.fn();
    const onTypedTurn = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <StoryParticipation
        {...makeProps({
          status: 'rendering',
          transcript: 'A line in progress.',
          onMic,
          onTypedTurn,
          onCancel,
        })}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Preparing response…');
    expect(
      (screen.getByRole('button', { name: 'Join the conversation' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    openWritePopover(container);
    expect(
      (screen.getByRole('textbox', { name: 'Write a reply' }) as HTMLTextAreaElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onMic).not.toHaveBeenCalled();
    expect(onTypedTurn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers replay and end-session controls when available', () => {
    const onReplay = vi.fn();
    const onCancel = vi.fn();
    render(<StoryParticipation {...makeProps({ sessionActive: true, onReplay, onCancel })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Replay reply' }));
    fireEvent.click(screen.getByRole('button', { name: 'End story session' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses the supplied error message and clamps an invalid microphone level', () => {
    render(
      <StoryParticipation
        {...makeProps({ status: 'error', level: 1.7, error: 'Permission was declined.' })}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('Permission was declined.');
    expect(
      screen.getByRole('meter', { name: 'Microphone level' }).getAttribute('aria-valuenow'),
    ).toBe('100');
    expect(screen.getByRole('button', { name: 'Join the conversation' })).toBeTruthy();
  });
  it('prevents joining or submitting a reply while the director is preparing a take', () => {
    const onMic = vi.fn();
    const onTypedTurn = vi.fn();
    render(<StoryParticipation {...makeProps({ disabled: true, onMic, onTypedTurn })} />);
    const join = screen.getByRole('button', { name: 'Join the conversation' }) as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    fireEvent.click(join);
    expect(onMic).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Write a reply', { selector: 'summary span' }));
    const input = screen.getByLabelText('Write a reply', {
      selector: 'textarea',
    }) as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(onTypedTurn).not.toHaveBeenCalled();
  });
});
