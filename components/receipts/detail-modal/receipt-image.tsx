'use client';

import { Receipt as ReceiptIcon, Maximize2, X, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ReceiptImageProps {
  imageUrl?: string
}

export function ReceiptImage({ imageUrl }: ReceiptImageProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl) return;

    setIsDownloading(true);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${new Date().toISOString()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Receipt image downloaded');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download receipt image');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className="sticky top-0 md:static w-full h-full flex items-center justify-center overflow-hidden bg-linear-to-br from-muted/20 to-muted/40">
        {imageUrl ? (
          <>
            {/* Image container */}
            <div className="w-full h-full flex items-center justify-center p-4 sm:p-6">
              <img
                src={imageUrl}
                alt="Receipt"
                className="max-w-full max-h-full h-auto object-contain rounded-lg shadow-2xl border border-border/50 bg-card"
                draggable={false}
              />
            </div>

            {/* Action Buttons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsFullscreen(true)}
                className="shadow-lg backdrop-blur-sm"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                View Fullscreen
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                disabled={isDownloading}
                className="shadow-lg backdrop-blur-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground p-12">
            <ReceiptIcon className="h-24 w-24 mb-4 opacity-20" />
            <p className="text-sm">No image available</p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && imageUrl && (
        <div
          className="fixed inset-0 z-100 bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
              disabled={isDownloading}
              className="shadow-lg"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-2 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background transition-colors"
              aria-label="Close fullscreen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <img
            src={imageUrl}
            alt="Receipt - Fullscreen"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
