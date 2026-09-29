'use client';

import type React from 'react';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Loader2, CheckCircle2, XCircle, X, RefreshCw, Camera, Lightbulb, FileImage } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { upload } from '@vercel/blob/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UploadItem {
  id: string
  file: File
  previewUrl: string
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  error?: string
  receiptId?: string
  blobUrl?: string
}

const ENV_PATH_PREFIX = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';

/*
 * What /api/receipt/upload's token actually allows. The inputs used to accept image/* and the
 * copy promised HEIC, so a HEIC (or GIF, or TIFF) passed the client check and then failed the
 * upload with a generic error. Restricting `accept` also makes iOS Safari convert HEIC photos to
 * JPEG before handing them over.
 */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',');
const MAX_FILE_MB = 15;

/** Blob pathnames are public URLs: keep them free of anything personal. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(-80) || 'receipt';
}

export function ReceiptBatchUpload({
  householdId,
  onUploadComplete,
}: {
  householdId?: string
  onUploadComplete?: () => void
}) {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Using a ref to track if we should auto-process
  const pendingFilesRef = useRef<UploadItem[]>([]);

  const addFiles = useCallback((files: File[]) => {
    const wrongType = files.filter(file => !ACCEPTED_TYPES.includes(file.type));
    const tooLarge = files.filter(file => ACCEPTED_TYPES.includes(file.type) && file.size > MAX_FILE_MB * 1024 * 1024);

    // These used to be dropped silently, so a HEIC or an oversized photo just never appeared.
    if (wrongType.length > 0) {
      toast.error(
        wrongType.length === 1
          ? `${wrongType[0].name} isn't a JPG, PNG or WebP image`
          : `${wrongType.length} files aren't JPG, PNG or WebP images`,
      );
    }
    if (tooLarge.length > 0) {
      toast.error(
        tooLarge.length === 1
          ? `${tooLarge[0].name} is over ${MAX_FILE_MB}MB`
          : `${tooLarge.length} files are over ${MAX_FILE_MB}MB`,
      );
    }

    const newItems: UploadItem[] = files
      .filter(file => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_FILE_MB * 1024 * 1024)
      .map(file => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'pending' as const,
        progress: 0,
      }));

    if (newItems.length > 0) {
      pendingFilesRef.current = newItems;
      setUploadItems(prev => [...prev, ...newItems]);
    }
  }, []);

  const handleFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    // Reset input so same file can be selected again
    if (e.target) {
      e.target.value = '';
    }
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  const removeItem = useCallback((id: string) => {
    setUploadItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const processItem = useCallback(async (item: UploadItem) => {
    try {
      // Step 1: Upload to Vercel Blob
      setUploadItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, status: 'uploading' as const, progress: 25 } : i)),
      );

      const receiptId = `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      // The pathname becomes part of a public URL (and ended up in logs and analytics), so it
      // must not carry the user's email address, which it used to.
      const blob = await upload(
        `${ENV_PATH_PREFIX}/receipts/${receiptId}/${safeFileName(item.file.name)}`,
        item.file,
        {
          access: 'public',
          handleUploadUrl: '/api/receipt/upload',
          clientPayload: JSON.stringify({ receiptId, householdId }),
        },
      );

      // Step 2: Create receipt entry in database
      const createResponse = await fetch('/api/receipt/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: blob.url,
          householdId,
        }),
      });

      if (!createResponse.ok) {
        const data = await createResponse.json().catch(() => ({}));
        // Keep the blob URL so Retry can create the entry without re-uploading.
        setUploadItems(prev => prev.map(i => (i.id === item.id ? { ...i, blobUrl: blob.url } : i)));
        throw new Error(data.error || 'Failed to create receipt entry');
      }

      const { receiptId: dbReceiptId } = await createResponse.json();

      // Step 3: Trigger async processing (fire and forget)
      setUploadItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? { ...i, status: 'processing' as const, progress: 50, blobUrl: blob.url, receiptId: dbReceiptId }
            : i,
        ),
      );

      // Start processing but don't wait for it
      fetch('/api/receipt/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiptId: dbReceiptId,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || 'Failed to process receipt');
          }

          setUploadItems(prev =>
            prev.map(i => (i.id === item.id ? { ...i, status: 'completed' as const, progress: 100 } : i)),
          );

          toast.success('Receipt processed successfully!');

          // Notify parent to refresh
          onUploadComplete?.();
        })
        .catch((error) => {
          setUploadItems(prev =>
            prev.map(i =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'failed' as const,
                    error: error instanceof Error ? error.message : 'Processing failed',
                  }
                : i,
            ),
          );
          toast.error(error instanceof Error ? error.message : 'Failed to process receipt');
        });

      // Mark as uploaded (processing happens async)
      setUploadItems(prev =>
        prev.map(i => (i.id === item.id ? { ...i, progress: 75 } : i)),
      );
    } catch (error) {
      setUploadItems(prev =>
        prev.map(i =>
          i.id === item.id
            ? {
                ...i,
                status: 'failed' as const,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : i,
        ),
      );
    }
  }, [householdId, onUploadComplete]);

  const retryItem = useCallback(async (id: string) => {
    const item = uploadItems.find(i => i.id === id);
    if (!item) return;

    // The upload itself failed, so there is nothing on the server to retry yet: start over.
    // (This used to return silently, so the Retry button did nothing.)
    if (!item.blobUrl) {
      processItem({ ...item, status: 'pending', progress: 0, error: undefined });
      return;
    }

    setUploadItems(prev =>
      prev.map(i => (i.id === id ? { ...i, status: 'processing' as const, progress: 50, error: undefined } : i)),
    );

    try {
      // If no receiptId, create the DB entry first
      let receiptId = item.receiptId;
      if (!receiptId) {
        const createResponse = await fetch('/api/receipt/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: item.blobUrl,
            householdId,
          }),
        });

        if (!createResponse.ok) {
          const data = await createResponse.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create receipt entry');
        }

        const createData = await createResponse.json();
        receiptId = createData.receiptId;
      }

      // A receipt that already exists is retried through the retry route, which also recovers
      // one left stuck in 'processing'.
      const processResponse = item.receiptId
        ? await fetch(`/api/receipts/${receiptId}/retry`, { method: 'POST' })
        : await fetch('/api/receipt/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiptId,
            }),
          });

      if (!processResponse.ok) {
        const data = await processResponse.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to process receipt');
      }

      setUploadItems(prev =>
        prev.map(i => (i.id === id ? { ...i, status: 'completed' as const, progress: 100 } : i)),
      );

      toast.success('Receipt processed successfully!');
      onUploadComplete?.();
    } catch (error) {
      setUploadItems(prev =>
        prev.map(i =>
          i.id === id
            ? {
                ...i,
                status: 'failed' as const,
                error: error instanceof Error ? error.message : 'Processing failed',
              }
            : i,
        ),
      );
      toast.error(error instanceof Error ? error.message : 'Failed to process receipt');
    }
  }, [uploadItems, householdId, onUploadComplete, processItem]);

  const processItems = useCallback(async (items: UploadItem[]) => {
    // Process all items in parallel (async)
    items.forEach(item => {
      if (item.status === 'pending') {
        processItem(item);
      }
    });
  }, [processItem]);

  // Auto-process newly added files
  useEffect(() => {
    if (pendingFilesRef.current.length > 0) {
      const itemsToProcess = pendingFilesRef.current;
      pendingFilesRef.current = [];
      processItems(itemsToProcess);
    }
  }, [uploadItems, processItems]);

  const clearCompleted = useCallback(() => {
    setUploadItems(prev => {
      const completed = prev.filter(i => i.status === 'completed');
      completed.forEach(item => URL.revokeObjectURL(item.previewUrl));
      return prev.filter(i => i.status !== 'completed');
    });
  }, []);

  const completedCount = uploadItems.filter(i => i.status === 'completed').length;
  const failedCount = uploadItems.filter(i => i.status === 'failed').length;
  const processingCount = uploadItems.length - completedCount - failedCount;

  // Show celebration when all uploads complete
  const allCompleted = uploadItems.length > 0 && completedCount === uploadItems.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
              Add receipts
            </CardTitle>
            <CardDescription className="mt-1">
              Drag a stack in, pick files, or take a photo
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tips Section. Was headed with a 📸 emoji. */}
        <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
            For a clean read
          </p>
          <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
            <li>Flat and well lit, with the whole receipt in frame</li>
            <li>The total and the date matter most — don&apos;t crop those off</li>
            <li>Trim the table, the floor and your thumb out of the shot</li>
            <li>A whole stack can go in at once</li>
          </ul>
        </div>

        {/* Upload Area - Drag & Drop Zone */}
        <div
          ref={dropZoneRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-200 cursor-pointer',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg'
              : 'border-muted-foreground/25 bg-linear-to-b from-muted/30 to-muted/50 hover:border-primary/50 hover:bg-muted/80',
          )}
        >
          {/* Animated background elements when dragging */}
          {isDragging && (
            <div className="absolute inset-0 overflow-hidden rounded-xl">
              <div className="absolute top-1/4 left-1/4 h-32 w-32 rounded-full bg-primary/20 blur-3xl animate-pulse" />
              <div className="absolute bottom-1/4 right-1/4 h-32 w-32 rounded-full bg-primary/20 blur-3xl animate-pulse delay-150" />
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center">
            {isDragging ? (
              <>
                <div className="rounded-full bg-primary/20 p-4 mb-3 animate-bounce">
                  <FileImage className="h-10 w-10 text-primary" />
                </div>
                <span className="text-lg font-semibold text-primary">Drop them here</span>
              </>
            ) : (
              <>
                <div className="rounded-full bg-muted p-4 mb-3">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                </div>
                <span className="text-base font-medium text-foreground">
                  Click to upload or drag & drop receipts
                </span>
                <span className="mt-1 text-sm text-muted-foreground">
                  PNG, JPG or WebP (max {MAX_FILE_MB}MB each)
                </span>
              </>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPT_ATTRIBUTE}
            multiple
            onChange={handleFilesChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            className="hidden"
            accept={ACCEPT_ATTRIBUTE}
            capture="environment"
            onChange={handleFilesChange}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileImage className="h-4 w-4 mr-2" />
            Browse Files
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 md:hidden"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Supports PNG, JPG, WebP • Max {MAX_FILE_MB}MB per file
        </p>

        {/* Upload Queue */}
        {uploadItems.length > 0 && (
          <div className="space-y-3 pt-2">
            {/* Status Bar */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold">{uploadItems.length} receipt{uploadItems.length !== 1 ? 's' : ''}</span>
                {completedCount > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    {completedCount} done
                  </span>
                )}
                {processingCount > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {processingCount} processing
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {failedCount} failed
                  </span>
                )}
              </div>
              {completedCount > 0 && (
                <Button onClick={clearCompleted} variant="ghost" size="sm" className="text-muted-foreground">
                  Clear Done
                </Button>
              )}
            </div>

            {/* Was "All receipts processed! 🎉" in a hardcoded green panel behind
                a sparkles medallion. */}
            {allCompleted && (
              <div className="flex items-center gap-3 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-success">
                <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-medium">
                    {completedCount} receipt{completedCount !== 1 ? 's' : ''} read and filed
                  </p>
                  <p className="text-sm opacity-80">They are on the timeline below.</p>
                </div>
              </div>
            )}

            {/* Upload Items List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {uploadItems.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-all duration-200',
                    item.status === 'failed' && 'bg-destructive/5 border-destructive/20',
                    item.status === 'completed' && 'border-success/20 bg-success/5',
                    item.status === 'uploading' || item.status === 'processing' ? 'bg-primary/5 border-primary/20' : 'bg-card',
                  )}
                >
                  {/* Preview Image */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                    <img
                      src={item.previewUrl}
                      alt="Receipt preview"
                      className={cn(
                        'h-full w-full object-cover transition-all',
                        item.status === 'failed' && 'opacity-50 grayscale',
                      )}
                    />
                    {item.status === 'completed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-success/40">
                        <CheckCircle2 className="h-6 w-6 text-white" />
                      </div>
                    )}
                    {item.status === 'failed' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-destructive/40">
                        <XCircle className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.file.name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                      {item.status === 'processing' && (
                        <span className="text-primary">• AI scanning...</span>
                      )}
                      {item.status === 'uploading' && (
                        <span className="text-primary">• Uploading...</span>
                      )}
                    </div>
                    {item.error && (
                      <div className="text-xs text-destructive mt-1">{item.error}</div>
                    )}
                    {(item.status === 'uploading' || item.status === 'processing') && (
                      <Progress value={item.progress} className="mt-2 h-1.5" />
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {item.status === 'failed' && (
                      <Button
                        onClick={() => retryItem(item.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-primary hover:text-primary"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    )}
                    {item.status !== 'uploading' && item.status !== 'processing' && (
                      <Button
                        onClick={() => removeItem(item.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {(item.status === 'uploading' || item.status === 'processing') && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
