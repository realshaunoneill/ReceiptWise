'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ReportIssueButtonProps {
  receiptId: string;
  onRetrySuccess?: () => void | Promise<void>;
}

export function ReportIssueButton({ receiptId, onRetrySuccess }: ReportIssueButtonProps) {
  const [open, setOpen] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleReanalyze = async () => {
    setIsReanalyzing(true);

    try {
      const response = await fetch(`/api/receipts/${receiptId}/retry`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to re-analyze receipt');
      }

      toast.success('Receipt re-analyzed successfully! The details have been updated.');
      setOpen(false);

      if (onRetrySuccess) {
        await onRetrySuccess();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to re-analyze receipt');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleContactSupport = () => {
    // Was support@smartspend.app — a domain with a null MX, so every report bounced.
    const subject = encodeURIComponent(`Receipt Analysis Issue - ${receiptId}`);
    const body = encodeURIComponent(`Hi,\n\nI found an issue with the receipt analysis for receipt ID: ${receiptId}\n\nPlease describe the issue:\n`);
    window.location.href = `mailto:support@receiptwise.io?subject=${subject}&body=${body}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Report incorrect data"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Report incorrect data</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Incorrect Data</DialogTitle>
          <DialogDescription>
            If the receipt analysis contains errors, you can try re-analyzing or contact support.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleReanalyze}
            disabled={isReanalyzing}
          >
            {isReanalyzing ? (
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            ) : (
              <RefreshCw className="h-5 w-5 shrink-0" />
            )}
            <div className="text-left">
              <div className="font-medium">Re-analyze receipt</div>
              <div className="text-xs text-muted-foreground">
                Process the image again with AI
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleContactSupport}
          >
            <Mail className="h-5 w-5 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Contact support</div>
              <div className="text-xs text-muted-foreground">
                Get help if re-analysis doesn&apos;t fix the issue
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
