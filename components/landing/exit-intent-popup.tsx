'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';

const POPUP_DISMISSED_KEY = 'exitIntentDismissed';
const POPUP_COOLDOWN_HOURS = 24;

export function ExitIntentPopup() {
  const [showPopup, setShowPopup] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);

  const handleMouseLeave = useCallback((e: MouseEvent) => {
    // Only trigger when mouse leaves through the top of the page
    if (e.clientY <= 0 && !hasTriggered) {
      // Check if popup was recently dismissed
      const dismissedAt = localStorage.getItem(POPUP_DISMISSED_KEY);
      if (dismissedAt) {
        const dismissedTime = parseInt(dismissedAt, 10);
        const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
        if (hoursSinceDismissed < POPUP_COOLDOWN_HOURS) {
          return;
        }
      }

      setShowPopup(true);
      setHasTriggered(true);
    }
  }, [hasTriggered]);

  useEffect(() => {
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseLeave]);

  const handleDismiss = () => {
    setShowPopup(false);
    localStorage.setItem(POPUP_DISMISSED_KEY, Date.now().toString());
  };

  const trialDays = process.env.NEXT_PUBLIC_STRIPE_TRIAL_DAYS;
  const hasFreeTrial = trialDays && parseInt(trialDays) > 0;

  return (
    <Dialog open={showPopup} onOpenChange={(open) => !open && handleDismiss()}>
      {/* DialogContent draws its own close button, which closes through onOpenChange and so
          also records the dismissal. A second hand-rolled X sat on top of it. */}
      <DialogContent className="sm:max-w-md">

        {/*
          Was "Wait! Don't Leave Empty-Handed" over a gift icon, with four
          benefits bulleted by sparkles. Sparkles standing in for a checkmark is
          the single most common tell of generated UI, and shouting at someone on
          their way out is not the tone of a product that holds financial
          records. This states what is on offer and lets them leave.
        */}
        <DialogHeader>
          <DialogTitle className="text-xl">Before you go</DialogTitle>
          <DialogDescription className="text-base">
            {hasFreeTrial ? (
              <>
                There is a {trialDays}-day free trial, and no charge if you cancel before
                it ends. Long enough to run a week of real receipts through it.
              </>
            ) : (
              <>
                It takes one receipt to see whether this is useful to you.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Benefits list */}
          <ul className="space-y-2">
            {[
              'Every receipt read and itemised for you',
              'Shared with your household as it arrives',
              'Searchable down to the line item',
              'Export it all whenever you want',
            ].map((benefit) => (
              <li key={benefit} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <Button asChild className="w-full gap-2" size="lg">
              <Link href="/sign-up" onClick={handleDismiss}>
                {hasFreeTrial ? `Start the ${trialDays}-day trial` : 'Create an account'}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleDismiss}
            >
              Maybe later
            </Button>
          </div>

          {hasFreeTrial && (
            <p className="text-center text-xs text-muted-foreground">
              Cancel anytime during the trial and you won&apos;t be charged
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
