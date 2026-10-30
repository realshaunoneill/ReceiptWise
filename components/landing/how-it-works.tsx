'use client';

import { Camera, ScanLine, Users, Wallet } from 'lucide-react';
import { SectionLabel } from '@/components/layout/section-label';
import { BILLS_LAUNCHED } from '@/lib/public-features';

/**
 * Replaces the previous testimonials/social-proof section.
 *
 * The old version shipped invented users, an invented rating and invented usage stats.
 * Until there are real customers willing to be quoted, this section explains the product
 * instead of inventing proof for it. Add real, permissioned testimonials here.
 */

// With the plan launched, it is the first step (the guided setup: pay, then the main bills, then
// what is left), and receipts and bills are how it fills itself in.
const planSteps = [
  {
    icon: Wallet,
    step: '01',
    title: 'Set up your month',
    description:
      'Add your pay and your main bills, or paste them from your budget spreadsheet. You see what is left after the bills, and what that comes to each week until payday.',
  },
  {
    icon: Camera,
    step: '02',
    title: 'Snap receipts, forward bills',
    description:
      // Receipts are images only (JPG, PNG, WebP): the upload route rejects PDFs. Bills take PDFs.
      // The extension is not on the Chrome Web Store yet, so it is not offered as a way in here.
      'Photograph a receipt or upload a screenshot of one, and upload a bill or forward it to your own ReceiptWise address. Each is read for you: the shop, every item and the total, or the bill and its amount.',
  },
  {
    icon: Users,
    step: '03',
    title: 'Plan it together',
    description:
      'Invite your partner or the family. One Premium covers up to six of you, and you all see the same month, and what is left of it.',
  },
];

const receiptSteps = [
  {
    icon: Camera,
    step: '01',
    title: 'Snap or upload',
    description:
      // Images only (JPG, PNG, WebP) — the upload route rejects PDFs. The extension is not on
      // the Chrome Web Store yet, so it is not offered as a way in here.
      'Photograph a paper receipt, or upload a photo or a screenshot of one. JPG, PNG and WebP all work.',
  },
  {
    // Was a Sparkles icon. A scan line says "this is being read" without the
    // fairy dust that every AI feature in every app is decorated with.
    icon: ScanLine,
    step: '02',
    title: 'It gets read',
    description:
      'Merchant, date, total, tax and every line item are extracted automatically and sorted into a spending category. No manual typing.',
  },
  {
    icon: Users,
    step: '03',
    title: 'Everyone sees it',
    description:
      'Receipts land in your shared household, so a partner or the family see the same picture of what was spent and by whom.',
  },
];

const steps = BILLS_LAUNCHED ? planSteps : receiptSteps;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t px-4 py-20"
      aria-labelledby="how-it-works-title"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-2xl">
          <SectionLabel index="03">How it works</SectionLabel>
          <h2
            id="how-it-works-title"
            className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Three steps, then it&apos;s automatic
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            {BILLS_LAUNCHED
              ? 'From payday to payday, with the bills, the receipts and what is left in one place, and no spreadsheet to keep up.'
              : 'From a crumpled receipt in your pocket to a shared, searchable spending history — without a spreadsheet in sight.'}
          </p>
        </div>

        <ol className="grid gap-10 md:grid-cols-3">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.step} className="border-t-2 border-primary/25 pt-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-primary" aria-hidden="true">
                    {item.step}
                  </span>
                  <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
