// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchitectureSheet } from './ArchitectureSheet';

let showModal: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;

beforeEach(() => {
  showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  });
  HTMLDialogElement.prototype.showModal = showModal;
  HTMLDialogElement.prototype.close = close;
});

afterEach(cleanup);

describe('ArchitectureSheet', () => {
  it('opens from its title button and closes from the dialog control', () => {
    render(<ArchitectureSheet />);
    const trigger = screen.getByRole('button', { name: 'How CUT! works' });
    const dialog = document.querySelector('dialog')!;

    expect(dialog.open).toBe(false);
    fireEvent.click(trigger);
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close How CUT! works' }));
    expect(close).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });

  it('explains the real pipeline and limitations without initiating provider work', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<ArchitectureSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'How CUT! works' }));

    expect(
      screen.getByText(/Voice activity and transcription.*text reasoning drafts/),
    ).toBeTruthy();
    expect(screen.getByText(/does not speak the actor’s finished line/)).toBeTruthy();
    expect(screen.getByText(/one next story turn/)).toBeTruthy();
    expect(screen.getByText(/TTS and Avatar prepare a one-line retake/)).toBeTruthy();
    expect(screen.getByText(/group view is a still illustration/)).toBeTruthy();
    expect(screen.getByText(/Idle clips add subtle motion/)).toBeTruthy();
    expect(screen.getByText(/function tools remain gated/)).toBeTruthy();
    expect(screen.getByText(/first generated performance can take a moment/)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('opens provider references in a separate context without opener access', () => {
    render(<ArchitectureSheet />);
    fireEvent.click(screen.getByRole('button', { name: 'How CUT! works' }));
    for (const name of ['Realtime', 'TTS', 'Avatar']) {
      const link = screen.getByRole('link', { name }) as HTMLAnchorElement;
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
      expect(link.rel).toContain('noreferrer');
    }
    expect(screen.getByRole('link', { name: 'TTS' }).getAttribute('href')).toContain(
      'higgs-tts/tags',
    );
  });
});
