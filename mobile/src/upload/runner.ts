import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppState, Platform } from 'react-native';
import { type WireCaptureResult } from '@shared/api/receipts';
import { invalidateReceiptQueries } from '@shared/query/refresh';
import { api, ApiError } from '../api/client';
import { queryClient } from '../query/client';
import { nextToUpload, nextWakeAt, reduce, type QueueEvent, type QueueItem } from './queue';

/**
 * Sends captures to POST /api/receipts/capture, one at a time, from the phone's own copies. The
 * queue (src/upload/queue.ts) and its images live in the app's documents, so a capture survives
 * the app being closed, the phone restarting, or no signal: it goes when it can.
 *
 * Images are re-encoded first: JPEG, at most 2400 px on the long side, which also turns HEIC
 * photos into something the server reads, and keeps each one well under Vercel's 4.5 MB limit.
 */

const IS_WEB = Platform.OS === 'web';
// Made on first use: the web preview has no file system, and building a path there throws.
let uploadsDir: Directory | null = null;
const dir = () => (uploadsDir ??= new Directory(Paths.document, 'uploads'));
const stateFile = () => new File(dir(), 'queue.json');
const LONG_EDGE = 2400;
const MAX_BYTES = 4 * 1024 * 1024;

let items: QueueItem[] = [];
let loaded = false;
let running = false;
let online = true;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(event: QueueEvent) {
  items = reduce(items, event);
  // Uploaded ones are dropped after a while; their receipts are in the list.
  items = items.filter((item) => item.status !== 'done' || Date.now() - item.createdAt < 60_000);
  persist();
  for (const listener of listeners) listener();
}

function persist() {
  if (IS_WEB) return;
  try {
    if (!dir().exists) dir().create({ intermediates: true, idempotent: true });
    stateFile().write(JSON.stringify(items));
  } catch {
    // A full disk: the queue still runs from memory.
  }
}

async function load() {
  if (loaded) return;
  loaded = true;
  if (!IS_WEB && stateFile().exists) {
    try {
      const stored = JSON.parse(await stateFile().text()) as QueueItem[];
      // Only entries whose image is still there (storage outlives app versions, so check it).
      items = Array.isArray(stored) ? stored.filter((item) => item && typeof item.id === 'string' && new File(item.fileUri).exists) : [];
    } catch {
      items = [];
    }
  }
  emit({ type: 'restore' });
}

export function getQueue(): QueueItem[] {
  return items;
}

export function isOnline(): boolean {
  return online;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Compress a photo or scan and keep the app's own copy of it. */
async function prepare(uri: string, width?: number, height?: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > LONG_EDGE) {
    context.resize(width >= height ? { width: LONG_EDGE } : { height: LONG_EDGE });
  }
  let image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  if (IS_WEB) return image.uri;
  if ((new File(image.uri).size ?? 0) > MAX_BYTES) {
    const smaller = ImageManipulator.manipulate(image.uri);
    smaller.resize(width && height && width < height ? { height: 2000 } : { width: 2000 });
    image = await (await smaller.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
  }
  if (!dir().exists) dir().create({ intermediates: true, idempotent: true });
  const copy = new File(dir(), `${Crypto.randomUUID()}.jpg`);
  new File(image.uri).copy(copy);
  return copy.uri;
}

export type CaptureInput = { uri: string; width?: number; height?: number; kind?: 'receipt' | 'auto'; householdId?: string | null };

/** Queue captures to upload; they go at once if there's a connection. */
export async function enqueue(captures: CaptureInput[]): Promise<void> {
  await load();
  for (const capture of captures) {
    const fileUri = await prepare(capture.uri, capture.width, capture.height);
    emit({
      type: 'add',
      item: {
        id: Crypto.randomUUID(),
        fileUri,
        mimeType: 'image/jpeg',
        kind: capture.kind ?? 'receipt',
        householdId: capture.householdId,
        createdAt: Date.now(),
        status: 'waiting',
        attempts: 0,
        notBefore: 0,
      },
    });
  }
  void run();
}

export function retry(id: string) {
  emit({ type: 'retry', id });
  void run();
}

export function discard(id: string) {
  const item = items.find((entry) => entry.id === id);
  emit({ type: 'remove', id });
  if (item) removeFile(item.fileUri);
}

function removeFile(uri: string) {
  if (IS_WEB) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Already gone.
  }
}

async function formFor(item: QueueItem): Promise<FormData> {
  const form = new FormData();
  if (IS_WEB) {
    form.append('file', await (await fetch(item.fileUri)).blob(), `${item.id}.jpg`);
  } else {
    // React Native's FormData sends a file from its uri.
    form.append('file', { uri: item.fileUri, name: `${item.id}.jpg`, type: item.mimeType } as unknown as Blob);
  }
  form.append('kind', item.kind);
  if (item.householdId !== undefined) form.append('householdId', item.householdId ?? '');
  return form;
}

/** Upload whatever is waiting, one at a time, until nothing is due. */
export async function run(): Promise<void> {
  await load();
  if (running || !online) return;
  running = true;
  try {
    for (let item = nextToUpload(items, Date.now()); item; item = nextToUpload(items, Date.now())) {
      emit({ type: 'start', id: item.id });
      try {
        const result = await api<WireCaptureResult>('/api/receipts/capture', {
          method: 'POST',
          form: await formFor(item),
          headers: { 'Idempotency-Key': item.id },
        });
        emit({ type: 'uploaded', id: item.id, receiptId: result.receiptId });
        removeFile(item.fileUri);
        void invalidateReceiptQueries(queryClient);
      } catch (error) {
        const apiError = error instanceof ApiError ? error : null;
        const retryable = !apiError || ['offline', 'server', 'rate-limited'].includes(apiError.kind);
        if (retryable) {
          emit({
            type: 'retryable',
            id: item.id,
            now: Date.now(),
            error: apiError?.message ?? "Couldn't upload",
            retryAfterMs: apiError?.retryAfterSeconds ? apiError.retryAfterSeconds * 1000 : undefined,
          });
          if (apiError?.kind === 'offline') break;
        } else {
          emit({ type: 'failed', id: item.id, error: apiError?.message ?? "Couldn't upload" });
        }
      }
    }
  } finally {
    running = false;
    schedule();
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  const at = nextWakeAt(items);
  if (at !== null) timer = setTimeout(() => void run(), Math.max(1000, at - Date.now()));
}

/** Start the queue: on launch, when the connection comes back, and when the app comes forward. */
export function startUploads(): () => void {
  void run();
  const net = NetInfo.addEventListener((state) => {
    const wasOnline = online;
    online = state.isConnected !== false;
    if (online && !wasOnline) void run();
    for (const listener of listeners) listener();
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') void run();
  });
  return () => {
    net();
    app.remove();
  };
}

/** Forget every waiting capture (signing out): the next account mustn't upload them. */
export function clearQueue() {
  for (const item of items) removeFile(item.fileUri);
  items = [];
  persist();
  for (const listener of listeners) listener();
}
