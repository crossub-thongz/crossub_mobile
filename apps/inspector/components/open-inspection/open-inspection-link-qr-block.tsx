'use client';

import { useState } from 'react';
import { Maximize2, Share2, Users, X, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { openInspectionQrImageUrl } from '@/lib/open-inspection-qr';

export function OpenInspectionLinkQrBlock({
  title,
  description,
  url,
  qrFilename,
  icon: Icon = Users,
}: {
  title: string;
  description: string;
  url: string;
  qrFilename: string;
  icon?: LucideIcon;
}) {
  const [enlarged, setEnlarged] = useState(false);
  const qrSrc = openInspectionQrImageUrl(url, 280);
  const largeQrSrc = openInspectionQrImageUrl(url, 420);

  const shareLink = async () => {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      } catch {
        toast.error('Could not share link');
      }
    }
  };

  return (
    <>
      <div className="space-y-3 py-1">
        <div className="flex items-start gap-3">
          <span className="bg-emerald-500/20 text-emerald-400 flex size-10 shrink-0 items-center justify-center rounded-full">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <img
            src={qrSrc}
            alt=""
            className="size-[7.25rem] shrink-0 rounded-lg bg-white p-1.5"
            loading="lazy"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-11 justify-center gap-2 rounded-lg text-xs font-semibold"
              onClick={() => void shareLink()}
            >
              <Share2 className="size-3.5" />
              Share link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-11 justify-center gap-2 rounded-lg text-xs font-semibold"
              onClick={() => setEnlarged(true)}
            >
              <Maximize2 className="size-3.5" />
              Enlarge
            </Button>
          </div>
        </div>
      </div>

      {enlarged ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Close QR"
            className="absolute inset-0 bg-black/70"
            onClick={() => setEnlarged(false)}
          />
          <div className="bg-background relative w-full max-w-sm rounded-2xl border border-border p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => setEnlarged(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <img
              src={largeQrSrc}
              alt={title}
              className="mx-auto size-64 rounded-xl bg-white p-2"
            />
            <p className="text-muted-foreground mt-3 break-all text-center text-[10px]">
              {qrFilename}
            </p>
            <Button
              type="button"
              className="mt-3 w-full gap-1.5"
              onClick={() => void shareLink()}
            >
              <Share2 className="size-3.5" />
              Share link
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
