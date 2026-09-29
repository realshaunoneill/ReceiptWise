import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Users } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HouseholdService } from '@/lib/services/household-service';
import { InviteActions, RememberInvite } from './invite-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Household invitation - ReceiptWise',
  robots: { index: false, follow: false },
};

const CLOSED_MESSAGES: Record<string, string> = {
  accepted: 'This invitation has already been accepted.',
  declined: 'This invitation was declined.',
  revoked: 'This invitation was withdrawn by the household owner.',
  expired: 'This invitation has expired. Ask the person who invited you for a new link.',
};

/*
 * The landing point for an invitation link.
 *
 * household_invitations.token was written on every invite and never read — there was no page
 * for it and no email provider — so someone without an account could not be invited at all.
 * The owner now copies this link from the Sharing page and sends it however they like.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invitation, { userId }] = await Promise.all([
    HouseholdService.getInvitationByToken(token),
    auth(),
  ]);

  const isPending = invitation?.status === 'pending';
  const expires = invitation?.expiresAt.toLocaleDateString('en-IE', { day: 'numeric', month: 'long' });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-8 w-auto" />
            <span className="text-xl font-bold text-foreground">ReceiptWise</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          {!invitation ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">This link isn&apos;t valid</CardTitle>
                <CardDescription>
                  Check you copied the whole link, or ask the person who invited you to send it again.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/">Go to ReceiptWise</Link>
                </Button>
              </CardContent>
            </>
          ) : !isPending ? (
            <>
              <CardHeader>
                <CardTitle className="text-2xl">{invitation.householdName}</CardTitle>
                <CardDescription>{CLOSED_MESSAGES[invitation.status] ?? 'This invitation is no longer open.'}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={userId ? '/sharing' : '/'}>{userId ? 'Go to Sharing' : 'Go to ReceiptWise'}</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <CardTitle className="text-2xl">Join {invitation.householdName}</CardTitle>
                <CardDescription className="text-base">
                  {invitation.invitedByEmail ?? 'Someone'} has invited you to share receipts in this
                  household. The link works until {expires}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Joining is free. Once you&apos;re in you can see the household&apos;s receipts —
                  merchant, date and total. Adding receipts, the line-item detail and the rest of
                  the household tools need your own Premium subscription.
                </p>

                {userId ? (
                  <InviteActions token={token} householdName={invitation.householdName} />
                ) : (
                  <>
                    <RememberInvite token={token} />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button asChild className="flex-1">
                        <Link href="/sign-up">Create an account</Link>
                      </Button>
                      <Button asChild variant="outline" className="flex-1">
                        <Link href="/sign-in">I already have one</Link>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You&apos;ll come straight back here to accept once you&apos;re signed in.
                    </p>
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
