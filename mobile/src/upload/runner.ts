import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { AppState, Platform } from 'react-native';
import { type WireBillDocument } from '@shared/api/bills';
import { type WireCaptureResult } from '@shared/api/receipts';
import { invalidateFinanceQueries, invalidateReceiptQueries } from '@shared/query/refresh';
import { api, ApiError } from '../api/client';
import { LEGACY_SLOT } from '../auth/account-list';
import { activeSlot, getAccounts, loadAccounts } from '../auth/accounts';
import { queryClient } from '../query/client';
import { nextToUpload, nextWakeAt, reduce, type QueueEvent, type QueueFile, type QueueItem } from './queue';

/**
 * Sends captures one at a time, from the phone's own copies: receipts to POST
 * /api/receipts/capture, bills to POST /api/bills/documents/capture. The queue
 * (src/upload/queue.ts) and its files live in the app's documents, so a capture survives the app
 * being closed, the phone restarting, or no signal: it goes when it can.
 *
 * Each capture belongs to whoever was on screen when it was taken, and uploads with that account's
 * session, so on a household's shared iPad a receipt never lands in the next person's account.
 *
 * Photos are re-encoded first: JPEG, at most 2400 px on the long side, which also turns HEIC
 * photos into something the server reads, and keeps each one well under Vercel's 4.5 MB limit. A
 * bill's pages go in one request, so they're made smaller to fit together.
 */

const IS_WEB = Platform.OS === 'web';
// Made on first use: the web preview has no file system, and building a path there throws.
let uploadsDir: Directory | null = null;
const dir = () => (uploadsDir ??= new Directory(Paths.document, 'uploads'));
const stateFile = () => new File(dir(), 'queue.json');
const LONG_EDGE = 2400;
const MAX_BYTES = 4 * 1024 * 1024;
/** Everything in one bill's request, under the server's 4 MB (lib/bill-capture.ts). */
const MAX_BILL_BYTES = 3.9 * 1024 * 1024;

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
  await loadAccounts();
  if (!IS_WEB && stateFile().exists) {
    try {
      const stored = JSON.parse(await stateFile().text()) as QueueItem[];
      // Only entries whose files are still there (storage outlives app versions, so check it).
      items = Array.isArray(stored)
        ? stored.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.files) && item.files.length > 0 && item.files.every((file) => typeof file?.uri === 'string' && new File(file.uri).exists))
        : [];
    } catch {
      items = [];
    }
    // An account no longer signed in here can't upload; its captures went when it signed out.
    const here = new Set(getAccounts().accounts.map((account) => account.slot));
    for (const item of items.filter((entry) => !here.has(entry.account ?? LEGACY_SLOT))) item.files.forEach((file) => removeFile(file.uri));
    items = items.filter((item) => here.has(item.account ?? LEGACY_SLOT));
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

/** Where a new file of the queue's goes. */
function newCopy(extension: string): File {
  if (!dir().exists) dir().create({ intermediates: true, idempotent: true });
  return new File(dir(), `${Crypto.randomUUID()}.${extension}`);
}

const sizeOf = (uri: string) => (IS_WEB ? 0 : new File(uri).size ?? 0);

/** Compress a photo or scan and keep the app's own copy of it. */
async function prepare(capture: CaptureInput, longEdge = LONG_EDGE, compress = 0.8): Promise<QueueFile> {
  const { uri } = capture;
  let { width, height } = capture;
  if (!width || !height) {
    // A scan comes without its size.
    ({ width, height } = await ImageManipulator.manipulate(uri).renderAsync());
  }
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > longEdge) {
    context.resize(width >= height ? { width: longEdge } : { height: longEdge });
  }
  let image = await (await context.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress });
  if (sizeOf(image.uri) > MAX_BYTES) {
    const smaller = ImageManipulator.manipulate(image.uri);
    smaller.resize(width < height ? { height: 2000 } : { width: 2000 });
    image = await (await smaller.renderAsync()).saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
  }
  const id = Crypto.randomUUID();
  if (IS_WEB) return { uri: image.uri, mimeType: 'image/jpeg', name: `${id}.jpg` };
  const copy = newCopy('jpg');
  new File(image.uri).copy(copy);
  return { uri: copy.uri, mimeType: 'image/jpeg', name: copy.name };
}

export type CaptureInput = { uri: string; width?: number; height?: number };

/** A capture of whoever is on screen. */
function add(item: Omit<QueueItem, 'id' | 'createdAt' | 'status' | 'attempts' | 'notBefore' | 'account'>) {
  const account = activeSlot() ?? undefined;
  emit({ type: 'add', item: { ...item, account, id: Crypto.randomUUID(), createdAt: Date.now(), status: 'waiting', attempts: 0, notBefore: 0 } });
}

/** Queue receipts to upload, one per photo; they go at once if there's a connection. */
export async function enqueue(captures: CaptureInput[], options: { kind?: 'receipt' | 'auto'; householdId?: string | null } = {}): Promise<void> {
  await load();
  for (const capture of captures) {
    add({ target: 'receipt', files: [await prepare(capture)], kind: options.kind ?? 'receipt', householdId: options.householdId });
  }
  void run();
}

/** Thrown before anything is queued, with words to show. */
export class CaptureTooLarge extends Error {}

/**
 * Queue one bill: the pages of a scan or photos (combined into one PDF on the server), or a PDF
 * as it is. All of it goes in one request, so it must fit under 4 MB together; a bigger PDF is
 * better forwarded by email.
 */
export async function enqueueBill(input: { pages: CaptureInput[] } | { pdf: { uri: string; name: string; size?: number | null } }, householdId: string | null): Promise<void> {
  await load();
  let files: QueueFile[];
  if ('pdf' in input) {
    const size = input.pdf.size ?? sizeOf(input.pdf.uri);
    if (size > MAX_BILL_BYTES) throw new CaptureTooLarge('That PDF is over 4 MB, too big to send from the app. Forward it to your ReceiptWise email address instead.');
    const name = input.pdf.name.replace(/[^\w.\- ]+/g, '_').slice(-80) || 'bill.pdf';
    if (IS_WEB) {
      files = [{ uri: input.pdf.uri, mimeType: 'application/pdf', name }];
    } else {
      const copy = newCopy('pdf');
      new File(input.pdf.uri).copy(copy);
      files = [{ uri: copy.uri, mimeType: 'application/pdf', name }];
    }
  } else {
    // Smaller than a receipt's photo: up to ten have to share one request.
    const many = input.pages.length > 2;
    files = [];
    for (const page of input.pages) files.push(await prepare(page, many ? 1800 : 2200, many ? 0.6 : 0.7));
    if (files.reduce((total, file) => total + sizeOf(file.uri), 0) > MAX_BILL_BYTES) {
      files.forEach((file) => removeFile(file.uri));
      throw new CaptureTooLarge('Those pages are too big to send together. Send fewer pages, or forward the bill by email.');
    }
  }
  add({ target: 'bill', files, kind: 'receipt', householdId });
  void run();
}

/**
 * iOS puts a file opened in the app ("Open in ReceiptWise") in Documents/Inbox; once the queue has
 * its own copy, that one goes.
 */
export function forgetInboxCopy(uri: string) {
  if (IS_WEB || !/\/Documents\/Inbox\//.test(uri)) return;
  removeFile(uri);
}

export function retry(id: string) {
  emit({ type: 'retry', id });
  void run();
}

export function discard(id: string) {
  const item = items.find((entry) => entry.id === id);
  emit({ type: 'remove', id });
  item?.files.forEach((file) => removeFile(file.uri));
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
  for (const file of item.files) {
    if (IS_WEB) {
      form.append('file', await (await fetch(file.uri)).blob(), file.name);
    } else {
      // React Native's FormData sends a file from its uri.
      form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    }
  }
  if (item.target === 'receipt') form.append('kind', item.kind);
  if (item.target === 'bill' && item.files[0]?.mimeType === 'application/pdf') form.append('fileName', item.files[0].name);
  if (item.householdId !== undefined) form.append('householdId', item.householdId ?? '');
  return form;
}

/** Send one capture, as the account it belongs to; the id of what it made. */
async function send(item: QueueItem): Promise<string> {
  const request = { method: 'POST' as const, form: await formFor(item), headers: { 'Idempotency-Key': item.id }, account: item.account ?? LEGACY_SLOT };
  if (item.target === 'bill') return (await api<WireBillDocument>('/api/bills/documents/capture', request)).id;
  return (await api<WireCaptureResult>('/api/receipts/capture', request)).receiptId;
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
        const resultId = await send(item);
        emit({ type: 'uploaded', id: item.id, resultId });
        item.files.forEach((file) => removeFile(file.uri));
        // Someone else's on screen now: their figures haven't changed.
        if ((item.account ?? LEGACY_SLOT) !== activeSlot()) continue;
        if (item.target === 'bill') {
          void queryClient.invalidateQueries({ queryKey: ['bill-documents'] });
          void invalidateFinanceQueries(queryClient);
        } else {
          void invalidateReceiptQueries(queryClient);
        }
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

/** Forget an account's waiting captures (it signed out), or everyone's: nobody else may upload them. */
export function clearQueue(account?: string) {
  const going = account === undefined ? items : items.filter((item) => (item.account ?? LEGACY_SLOT) === account);
  for (const item of going) item.files.forEach((file) => removeFile(file.uri));
  items = items.filter((item) => !going.includes(item));
  persist();
  for (const listener of listeners) listener();
}
