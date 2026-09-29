'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Receipt, Home, Calendar, CreditCard, Mail, Eye, ChevronDown, ChevronUp, Ban, CheckCircle, Edit2, Crown } from 'lucide-react';
import { useUpdateUser } from '@/hooks/use-admin-users';
import type { ReceiptWithItems } from '@/lib/types/api-responses';

interface UserCardProps {
  user: {
    id: string
    email: string
    subscribed: boolean
    isAdmin: boolean
    isBlocked?: boolean
    blockedAt?: string | null
    blockedReason?: string | null
    createdAt: string
    stripeCustomerId: string | null
    receiptCount: number
    householdCount: number
  }
  isExpanded: boolean
  onToggle: () => void
  userReceipts?: ReceiptWithItems[]
  onOpenReceipt: (receiptId: string) => void
}

export function UserCard({ user, isExpanded, onToggle, userReceipts, onOpenReceipt }: UserCardProps) {
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [showEditReasonDialog, setShowEditReasonDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [blockReason, setBlockReason] = useState(user.blockedReason || '');
  
  const updateUser = useUpdateUser();
  const isPending = updateUser.isPending;

  const handleBlock = () => {
    updateUser.mutate(
      { userId: user.id, isBlocked: true, blockedReason: blockReason || undefined },
      {
        onSuccess: () => {
          setShowBlockDialog(false);
          setBlockReason('');
        },
      }
    );
  };

  const handleUnblock = () => {
    updateUser.mutate(
      { userId: user.id, isBlocked: false },
      {
        onSuccess: () => {
          setShowUnblockDialog(false);
        },
      }
    );
  };

  const handleUpdateReason = () => {
    updateUser.mutate(
      { userId: user.id, blockedReason: blockReason },
      {
        onSuccess: () => {
          setShowEditReasonDialog(false);
        },
      }
    );
  };

  const handleToggleSubscription = () => {
    updateUser.mutate(
      { userId: user.id, subscribed: !user.subscribed },
      {
        onSuccess: () => {
          setShowSubscriptionDialog(false);
        },
      }
    );
  };

  return (
    <>
    <div className={`rounded-lg border ${user.isBlocked ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium break-all">{user.email}</span>
            {user.isAdmin && (
              <Badge variant="destructive">Admin</Badge>
            )}
            {user.subscribed && (
              <Badge variant="default">Subscribed</Badge>
            )}
            {user.isBlocked && (
              <Badge variant="outline" className="border-destructive text-destructive">
                <Ban className="h-3 w-3 mr-1" />
                Blocked
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Receipt className="h-3 w-3" />
              {user.receiptCount} receipts
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Home className="h-3 w-3" />
              {user.householdCount} households
            </span>
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="h-3 w-3" />
              Joined {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
          {user.isBlocked && user.blockedReason && (
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-destructive">
                Reason: {user.blockedReason}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setBlockReason(user.blockedReason || '');
                  setShowEditReasonDialog(true);
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {user.stripeCustomerId && (
            <Badge variant="outline" className="gap-1">
              <CreditCard className="h-3 w-3" />
              <span className="hidden sm:inline">Stripe Customer</span>
              <span className="sm:hidden">Stripe</span>
            </Badge>
          )}
          
          {/* Subscription Toggle Button */}
          {!user.isAdmin && (
            <Button
              variant={user.subscribed ? 'default' : 'outline'}
              size="sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                setShowSubscriptionDialog(true);
              }}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Crown className="h-3 w-3 mr-1" />
                  {user.subscribed ? 'Subscribed' : 'Not subscribed'}
                </>
              )}
            </Button>
          )}

          {/* Block/Unblock Button */}
          {!user.isAdmin && (
            <Button
              variant={user.isBlocked ? 'outline' : 'destructive'}
              size="sm"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                if (user.isBlocked) {
                  setShowUnblockDialog(true);
                } else {
                  setBlockReason('');
                  setShowBlockDialog(true);
                }
              }}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : user.isBlocked ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Unblock
                </>
              ) : (
                <>
                  <Ban className="h-3 w-3 mr-1" />
                  Block
                </>
              )}
            </Button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="border-t p-4 bg-muted/20">
          <h4 className="text-sm font-semibold mb-3">User Receipts</h4>
          {userReceipts ? (
            userReceipts.length > 0 ? (
              <div className="space-y-2">
                {userReceipts.map(receipt => (
                  <div
                    key={receipt.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-background p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenReceipt(receipt.id);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Receipt className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{receipt.merchantName || 'Unknown'}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {receipt.processingStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 justify-between sm:justify-end">
                      <span className="text-sm font-medium">
                        {receipt.currency} {receipt.totalAmount}
                      </span>
                      <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No receipts found</p>
            )
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>

    {/* Block User Dialog */}
    <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to block {user.email}? They will not be able to access the app until unblocked.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="block-reason">Reason (optional)</Label>
          <Textarea
            id="block-reason"
            placeholder="Enter reason for blocking..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBlock}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Block User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Unblock User Dialog */}
    <AlertDialog open={showUnblockDialog} onOpenChange={setShowUnblockDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unblock User</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to unblock {user.email}? They will regain access to the app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnblock} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Unblock User
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Edit Block Reason Dialog */}
    <AlertDialog open={showEditReasonDialog} onOpenChange={setShowEditReasonDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Edit Block Reason</AlertDialogTitle>
          <AlertDialogDescription>
            Update the reason for blocking {user.email}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Label htmlFor="edit-block-reason">Reason</Label>
          <Textarea
            id="edit-block-reason"
            placeholder="Enter reason for blocking..."
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpdateReason} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Reason
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Subscription Toggle Dialog */}
    <AlertDialog open={showSubscriptionDialog} onOpenChange={setShowSubscriptionDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {user.subscribed ? 'Remove Subscription' : 'Grant Subscription'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {user.subscribed
              ? `Are you sure you want to remove the subscription from ${user.email}? They will lose access to premium features.`
              : `Are you sure you want to grant a subscription to ${user.email}? They will gain access to all premium features.`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleToggleSubscription}
            disabled={isPending}
            className={user.subscribed ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {user.subscribed ? 'Remove Subscription' : 'Grant Subscription'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
