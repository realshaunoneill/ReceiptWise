'use client';

import type React from 'react';

import { useState } from 'react';
import { UserPlus, Loader2, Link2, Copy, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSendInvitation } from '@/lib/hooks/use-invitations';
import { copyInviteLink } from '@/components/households/copy-invite-link';

interface InviteMemberDialogProps {
  householdId: string
  onMemberInvited?: () => void
  triggerVariant?: 'default' | 'outline'
}

/*
 * There is no email provider, so nothing is sent: the dialog creates the invitation and hands
 * the owner a link to pass on. It used to say "They'll receive an email to accept" — no email
 * ever went out, and someone without an account had no way to find the invitation at all.
 */
export function InviteMemberDialog({ householdId, onMemberInvited, triggerVariant = 'outline' }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sendInvitation = useSendInvitation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    try {
      const invitation = await sendInvitation.mutateAsync({ householdId, email: trimmed });
      setInviteUrl(invitation.inviteUrl);
      onMemberInvited?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create the invitation');
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    if (await copyInviteLink(inviteUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEmail('');
      setErrorMessage('');
      setInviteUrl(null);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {inviteUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Send them this link</DialogTitle>
              <DialogDescription>
                Text or email it to them yourself. If they already use ReceiptWise with that
                address, it will also appear in their notifications. It works once and expires in
                7 days.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 py-4">
              <Input value={inviteUrl} readOnly aria-label="Invitation link" className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button type="button" onClick={handleCopy} className="shrink-0">
                {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Invite someone</DialogTitle>
              <DialogDescription>
                You&apos;ll get a link to send them. Joining is free; adding receipts needs their
                own Premium subscription.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
              <div>
                <Label htmlFor={`invite-email-${householdId}`}>Their email address</Label>
                <Input
                  id={`invite-email-${householdId}`}
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  className="mt-2"
                  required
                  autoFocus
                />
              </div>
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {errorMessage}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendInvitation.isPending || !email.trim()}>
                {sendInvitation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Create invite link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
