import { beforeEach, vi } from 'vitest';

// CI tests never need live generation. A real fetch is a test failure.
beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Network calls are disabled in unit tests.');
  });
});
