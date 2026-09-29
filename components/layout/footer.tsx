import Link from 'next/link';
import { CookieSettingsButton } from '@/components/layout/consent-banner';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50 px-4 py-12 backdrop-blur-sm">
      <div className="container mx-auto">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" width={28} height={28} className="h-7 w-7" aria-hidden="true" />
            <span className="font-semibold tracking-tight text-foreground">ReceiptWise</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/refund" className="transition-colors hover:text-foreground">Refunds</Link>
            <Link href="/support" className="transition-colors hover:text-foreground">Support</Link>
            <CookieSettingsButton className="transition-colors hover:text-foreground" />
            <a href="mailto:support@receiptwise.io" className="transition-colors hover:text-foreground">
              support@receiptwise.io
            </a>
          </nav>
        </div>
        {/* Was a centred "All rights reserved." on its own bordered row — the
            boilerplate takes a line to itself, so it now shares one. */}
        <p className="mt-8 border-t border-border/50 pt-6 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} ReceiptWise
        </p>
      </div>
    </footer>
  );
}
