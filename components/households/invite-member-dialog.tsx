'use client';

import type React from 'react';

import { useState } from 'react';
import { UserPlus, Loader2, Mail, CheckCircle2, AlertCircle } from 'lucide-react';
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
import { inviteMember } from '@/lib/household-actions';

interface InviteMemberDialogProps {
  householdId: string
  onMemberInvited: () => void
}

export function InviteMemberDialog({ householdId, onMemberInvited }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    setSuccessMessage('');
    try {
      await inviteMember({ householdId, email: email.trim() });
      setSuccessMessage(`Invitation sent to ${email}`);
      setEmail('');
      setTimeout(() => {
        onMemberInvited();
        setOpen(false);
        setSuccessMessage('');
      }, 2000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setEmail('');
      setErrorMessage('');
      setSuccessMessage('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">Invite Member</DialogTitle>
            <DialogDescription className="text-center">
              Send an invitation to join this household. They&apos;ll receive an email to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="member@example.com"
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
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{successMessage}</p>
                  <p className="text-xs opacity-80">They will need to accept it to join.</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isInviting || !email.trim() || !!successMessage}>
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
