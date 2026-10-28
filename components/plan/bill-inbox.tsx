'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, FileText, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLocalDate } from '@/lib/dates/local-date';
import {
  type ApplyBillAction,
  type ClientBillDocument,
  useApplyBill,
  useBillInbox,
  useDeleteBill,
  useRetryBill,
  useUploadBill,
} from '@/lib/hooks/use-bill-documents';
import { toCents } from '@/lib/money';
import { type PlanResponse } from '@/lib/services/plan-service';
import { formatCents } from '@/lib/utils/currency';

type BillInboxProps = {
  plan: PlanResponse;
  householdId?: string;
};

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

const shortDate = (day: string) => formatLocalDate(day, { day: 'numeric', month: 'short' }, 'en-IE');

function money(amount: string | null, currency: string | null, fallbackCurrency: string): string | null {
  const cents = toCents(amount);
  return cents === null ? null : formatCents(cents, currency ?? fallbackCurrency);
}

/**
 * The bills already brought in, newest first, for saying what a possible duplicate repeats. Only
 * fetched when the inbox has one whose original isn't in the inbox itself (it was filed already).
 */
function useEarlierBills(householdId: string | undefined, enabled: boolean) {
  return useQuery<ClientBillDocument[]>({
    queryKey: ['bill-documents', 'all', householdId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (householdId) params.set('householdId', householdId);
      const res = await fetch(`/api/bills/documents?${params}`);
      if (!res.ok) throw new Error('Failed to load bills');
      return res.json() as Promise<ClientBillDocument[]>;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** "the Electric Ireland bill of 3 Oct": what a possible duplicate is a duplicate of. */
function describeOriginal(original: ClientBillDocument | undefined): string {
  if (!original) return 'a bill already brought in';
  const day = original.issueDate ?? original.dueDate;
  const name = original.provider ? `the ${original.provider} bill` : `${original.fileName ?? 'a bill'}`;
  return day ? `${name} of ${shortDate(day)}` : `${name} uploaded ${shortDate(new Date(original.createdAt).toISOString().slice(0, 10))}`;
}

/**
 * Bills brought in: upload a PDF or a photo (the camera on a phone), it is read, and then filed
 * against the bill it belongs to, which sets that month's amount and due date in the plan. A bill
 * from a provider already filed once goes straight in and shows here as done.
 *
 * Titled "Bills to file" (it was "Bill inbox", and before that "Bills", both easily taken for the
 * Bills page in the menu): where uploaded and emailed bills wait to be filed.
 */
export function BillInbox({ plan, householdId }: BillInboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: documents = [] } = useBillInbox(householdId);
  const { mutate: uploadBill, isPending: uploading } = useUploadBill();
  const missingOriginal = documents.some((document) =>
    document.duplicateOfId && !documents.some((other) => other.id === document.duplicateOfId));
  const { data: earlier = [] } = useEarlierBills(householdId, missingOriginal);
  const findOriginal = (id: string) => documents.find((other) => other.id === id) ?? earlier.find((other) => other.id === id);

  const onFiles = (files: FileList | null) => {
    for (const file of Array.from(files ?? [])) {
      uploadBill(
        { file, householdId },
        {
          onSuccess: () => toast.success(`Reading ${file.name}…`),
          onError: (error) => toast.error(error.message),
        },
      );
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const uploadButton = (
    <>
      <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
        Upload a bill
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
        aria-label="Upload a bill"
      />
    </>
  );

  // Nothing waiting: one slim row (the plan puts it at the bottom), not a card of its own, and
  // called what it does: "Bills to file" read like a queue when nothing was in it.
  if (documents.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Bring in a bill</span> · Upload a bill (a PDF or a photo) and it&apos;s read into the right month, or{' '}
          <Link href="/settings?tab=integrations" className="text-primary underline-offset-2 hover:underline">forward it by email</Link>.
        </p>
        <div className="shrink-0">{uploadButton}</div>
      </div>
    );
  }

  return (
    <Card data-private>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Bills to file</CardTitle>
        {uploadButton}
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((document) => (
          <BillDocumentCard
            key={document.id}
            document={document}
            plan={plan}
            duplicateOf={document.duplicateOfId ? describeOriginal(findOriginal(document.duplicateOfId)) : null}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function BillDocumentCard({ document, plan, duplicateOf }: { document: ClientBillDocument; plan: PlanResponse; duplicateOf: string | null }) {
  const { mutate: applyBill, isPending: applying } = useApplyBill();
  const { mutate: retryBill, isPending: retrying } = useRetryBill();
  const { mutate: deleteBill } = useDeleteBill();
  const month = plan.period.label.split(' ')[0];
  const name = document.provider || document.fileName || 'Bill';
  const amount = money(document.amountDue, document.currency, plan.currency);
  const minimum = money(document.minimumPayment, document.currency, plan.currency);
  const due = document.dueDate ? shortDate(document.dueDate) : null;

  const apply = (action: ApplyBillAction, done: string) =>
    applyBill({ id: document.id, action }, { onSuccess: () => toast.success(done), onError: (error) => toast.error(error.message) });

  const fileLink = (
    <a
      href={`/api/bills/documents/${document.id}/file`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ExternalLink className="h-3 w-3" />View
    </a>
  );

  if (document.processingStatus === 'pending' || document.processingStatus === 'processing') {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">Reading {document.fileName ?? 'your bill'}…</span>
      </div>
    );
  }

  if (document.processingStatus === 'failed') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{document.fileName ?? 'Bill'}</p>
          <p className="text-xs text-muted-foreground">{document.processingError}</p>
        </div>
        <Button size="sm" variant="ghost" disabled={retrying} onClick={() => retryBill(document.id, { onError: (error) => toast.error(error.message) })}>
          <RotateCcw className="mr-1 h-4 w-4" />Retry
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove" onClick={() => deleteBill(document.id)}><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  if (document.reviewStatus === 'applied') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">{name}</span>
          {amount && <span className="amount"> · {amount}</span>}
          {due && <span> due {due}</span>}
          <span className="text-muted-foreground"> · filed automatically</span>
        </span>
        {fileLink}
      </div>
    );
  }

  if (document.reviewStatus === 'needs_document' || document.reviewStatus === 'not_a_bill') {
    return (
      <div className="flex items-center gap-3 rounded-lg border p-3 text-sm">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {document.reviewStatus === 'needs_document'
              ? 'This only says the bill is ready online. Download the bill itself and upload that.'
              : "This doesn't look like a bill."}
          </p>
        </div>
        {fileLink}
        <Button size="sm" variant="ghost" onClick={() => apply({ action: 'dismiss' }, 'Dismissed')} disabled={applying}>Dismiss</Button>
      </div>
    );
  }

  // Waiting to be filed
  const isCard = document.documentType === 'credit_card_statement';
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">
            {amount ? <span className="amount font-semibold text-foreground">{amount}</span> : 'No amount found'}
            {due && <> due {due}</>}
            {document.periodStart && document.periodEnd && (
              <> · for {shortDate(document.periodStart)} – {shortDate(document.periodEnd)}</>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isCard && <Badge variant="outline">Card statement</Badge>}
            {document.isDirectDebit && <Badge variant="outline">Direct debit</Badge>}
            {duplicateOf && <Badge variant="secondary" className="whitespace-normal text-left">Possible duplicate of {duplicateOf}</Badge>}
          </div>
        </div>
        {fileLink}
      </div>

      <div className="flex flex-wrap gap-2">
        {document.suggestions.map((suggestion) => (
          <Button
            key={suggestion.id}
            size="sm"
            disabled={applying || !amount}
            onClick={() => apply({ action: 'match', subscriptionId: suggestion.id }, `Filed against ${suggestion.name}`)}
          >
            File as {suggestion.name}
          </Button>
        ))}
        {isCard && minimum && document.suggestions[0] && (
          <Button
            size="sm"
            variant="outline"
            disabled={applying}
            onClick={() => apply({ action: 'match', subscriptionId: document.suggestions[0].id, amount: 'minimum' }, 'Filed at the minimum payment')}
          >
            Pay the minimum ({minimum})
          </Button>
        )}
        <Button size="sm" variant={document.suggestions.length ? 'outline' : 'default'} disabled={applying || !amount}
          onClick={() => apply({ action: 'new_bill' }, `${name} added as a bill`)}>
          New regular bill
        </Button>
        <Button size="sm" variant="outline" disabled={applying || !amount}
          onClick={() => apply({ action: 'one_off' }, `Added to ${month}`)}>
          Just this once
        </Button>
        <Button size="sm" variant="ghost" disabled={applying} onClick={() => apply({ action: 'dismiss' }, 'Dismissed')}>Dismiss</Button>
      </div>
    </div>
  );
}
