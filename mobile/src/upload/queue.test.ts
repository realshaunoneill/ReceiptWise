import { describe, expect, it } from 'vitest';
import { backoffMs, MAX_ATTEMPTS, nextToUpload, nextWakeAt, queueSummary, reduce, type QueueItem } from './queue';

const item = (id: string, createdAt: number, overrides: Partial<QueueItem> = {}): QueueItem => ({
  id, fileUri: `file:///${id}.jpg`, mimeType: 'image/jpeg', kind: 'receipt', createdAt, status: 'waiting', attempts: 0, notBefore: 0, ...overrides,
});

describe('upload queue', () => {
  it('sends one at a time, oldest first', () => {
    const items = [item('b', 2), item('a', 1)];
    expect(nextToUpload(items, 10)?.id).toBe('a');
    const started = reduce(items, { type: 'start', id: 'a' });
    expect(nextToUpload(started, 10)).toBeUndefined();
    const done = reduce(started, { type: 'uploaded', id: 'a', receiptId: 'r1' });
    expect(done[1]).toMatchObject({ status: 'done', receiptId: 'r1' });
    expect(nextToUpload(done, 10)?.id).toBe('b');
  });

  it('waits and backs off after a dropped connection, then gives up', () => {
    let items = reduce([item('a', 1)], { type: 'start', id: 'a' });
    items = reduce(items, { type: 'retryable', id: 'a', now: 1000, error: 'offline' });
    expect(items[0]).toMatchObject({ status: 'waiting', notBefore: 1000 + backoffMs(1) });
    expect(nextToUpload(items, 1000)).toBeUndefined();
    expect(nextWakeAt(items)).toBe(1000 + backoffMs(1));

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      items = reduce(reduce(items, { type: 'start', id: 'a' }), { type: 'retryable', id: 'a', now: 0, error: 'offline' });
    }
    expect(items[0].status).toBe('failed');
  });

  it("honours the server's Retry-After over its own backoff", () => {
    const items = reduce(reduce([item('a', 1)], { type: 'start', id: 'a' }), { type: 'retryable', id: 'a', now: 0, error: 'rate', retryAfterMs: 120_000 });
    expect(items[0].notBefore).toBe(120_000);
  });

  it('backs off from 30 seconds to at most 15 minutes', () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(2)).toBe(60_000);
    expect(backoffMs(20)).toBe(15 * 60_000);
  });

  it('retries from scratch on request, and recovers uploads cut off by a restart', () => {
    const failed = item('a', 1, { status: 'failed', attempts: 8, error: 'x' });
    expect(reduce([failed], { type: 'retry', id: 'a' })[0]).toMatchObject({ status: 'waiting', attempts: 0, error: undefined });
    expect(reduce([item('b', 1, { status: 'uploading' })], { type: 'restore' })[0].status).toBe('waiting');
  });

  it('never queues the same capture twice', () => {
    expect(reduce([item('a', 1)], { type: 'add', item: item('a', 2) })).toHaveLength(1);
  });

  it('says what is happening in plain words', () => {
    expect(queueSummary([], true)).toBeNull();
    expect(queueSummary([item('a', 1, { status: 'done' }), item('b', 2, { status: 'uploading' }), item('c', 3)], true)).toBe('Uploading 2 of 3');
    expect(queueSummary([item('a', 1), item('b', 2)], false)).toBe('2 receipts waiting for a connection');
    expect(queueSummary([item('a', 1, { status: 'failed' })], true)).toBe("1 receipt didn't upload");
  });
});
