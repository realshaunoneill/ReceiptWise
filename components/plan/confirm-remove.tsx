'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * "Remove", then "Remove it? Yes / No" in place: removing used to act on the first tap, and a
 * stray tap in a dialog deleted an income or a goal for good.
 */
export function ConfirmRemove({
  onConfirm,
  disabled,
  label = 'Remove',
  question = 'Remove it?',
  resetKey,
}: {
  onConfirm: () => void;
  disabled?: boolean;
  label?: string;
  question?: string;
  /** Changing this (the dialog reopening, another item) puts the button back. */
  resetKey?: unknown;
}) {
  // Asking for the item it was opened on only, so a new resetKey shows the plain button again.
  const [askedFor, setAskedFor] = useState<{ key: unknown } | null>(null);
  const asking = askedFor !== null && Object.is(askedFor.key, resetKey);

  if (!asking) {
    return (
      <Button variant="ghost" className="text-destructive" disabled={disabled} onClick={() => setAskedFor({ key: resetKey })}>
        {label}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1" role="group" aria-label={question}>
      <span className="text-sm text-muted-foreground">{question}</span>
      <Button variant="destructive" size="sm" disabled={disabled} onClick={onConfirm}>Yes</Button>
      <Button variant="ghost" size="sm" onClick={() => setAskedFor(null)} autoFocus>No</Button>
    </div>
  );
}
