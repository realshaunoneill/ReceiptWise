import { describe, expect, it } from 'vitest';
import { AI_CALLS_PER_DAY, AI_CALLS_PER_HOUR, judgeAiBudget } from './ai-budget';

describe('judgeAiBudget', () => {
  it('allows calls up to and including the limits', () => {
    expect(judgeAiBudget(1, 1)).toEqual({ ok: true });
    expect(judgeAiBudget(AI_CALLS_PER_HOUR, AI_CALLS_PER_DAY)).toEqual({ ok: true });
  });

  it('refuses past the daily limit first, then the hourly one', () => {
    expect(judgeAiBudget(AI_CALLS_PER_HOUR + 1, AI_CALLS_PER_DAY + 1)).toMatchObject({ ok: false, retryAfterSeconds: 3600 });
    expect(judgeAiBudget(AI_CALLS_PER_HOUR + 1, 100)).toMatchObject({ ok: false, retryAfterSeconds: 900 });
  });
});
