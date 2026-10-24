import { describe, expect, it } from 'vitest';
import { extractStormChangeSet, summarizeRealtimeResponse } from './realtime-probe.ts';

describe('pure Realtime probe summaries', () => {
  it('accepts only the completed client change_set call with exactly the controlled effect', () => {
    expect(
      extractStormChangeSet({
        type: 'response.done',
        response: {
          status: 'completed',
          output: [
            {
              type: 'function_call',
              executor: 'client',
              name: 'change_set',
              call_id: 'synthetic-call-id',
              arguments: '{"effect":"storm"}',
            },
          ],
        },
      }),
    ).toEqual({ callId: 'synthetic-call-id', effect: 'storm' });
  });

  it('rejects server calls, invalid effects, and extra argument keys', () => {
    const baseCall = {
      type: 'function_call',
      name: 'change_set',
      call_id: 'synthetic-call-id',
      arguments: '{"effect":"storm"}',
    };
    const done = (call: Record<string, unknown>) => ({
      type: 'response.done',
      response: { status: 'completed', output: [call] },
    });

    expect(extractStormChangeSet(done({ ...baseCall, executor: 'server' }))).toBeNull();
    expect(
      extractStormChangeSet(
        done({ ...baseCall, executor: 'client', arguments: '{"effect":"rain"}' }),
      ),
    ).toBeNull();
    expect(
      extractStormChangeSet(
        done({ ...baseCall, executor: 'client', arguments: '{"effect":"storm","extra":true}' }),
      ),
    ).toBeNull();
  });

  it('summarizes safe response fields without preserving arbitrary item names or payloads', () => {
    expect(
      summarizeRealtimeResponse({
        response: {
          status: 'completed',
          output: [
            {
              type: 'function_call',
              name: 'change_set',
              executor: 'client',
              arguments: 'never retained',
            },
            { type: 'function_call', name: 'sensitive-tool-name', executor: 'unknown' },
            { type: 'unrecognized-item', text: 'never retained' },
          ],
        },
      }),
    ).toEqual({
      status: 'completed',
      outputItems: [
        { type: 'function_call', functionName: 'change_set', executor: 'client' },
        { type: 'function_call', functionName: 'other' },
        { type: 'other' },
      ],
    });
  });
});
