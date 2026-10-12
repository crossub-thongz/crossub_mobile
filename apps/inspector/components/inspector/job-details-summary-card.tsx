'use client';

import { Calendar, Compass, Hash } from 'lucide-react';

import { InitialsAvatar } from '@/components/inspector/initials-avatar';
import { PayBreakdown } from '@/components/inspector/pay-breakdown';
import { PropertyThumb } from '@/components/inspector/property-thumb';
import { Button } from '@/components/ui/button';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import { formatJobRefId } from '@/lib/job-cancellation';
import { inspectTypeLabel } from '@/lib/inspect-type-visual';
import { buildMapUrl } from '@/lib/navigation';
import { propertyAddressLines } from '@/lib/property-address';
import type { InspectionJob } from '@/lib/types';
import { formatScheduleWhen } from '@/lib/utils';

export function JobDetailsSummaryCard({ job }: { job: InspectionJob }) {
  const { profile } = useInspectorData();
  const deviceLocation = useDeviceLocation();
  const { street, locality } = propertyAddressLines(job);
  const directionsHref = buildMapUrl(
    'google',
    job.propertyAddress,
    job.latitude,
    job.longitude,
    deviceLocation ?? undefined,
  );

  return (
    <div className="border-border bg-card space-y-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-foreground text-sm font-semibold">Job Details</h2>
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
          {inspectTypeLabel(job.type)}
        </span>
      </div>

      <div className="flex items-start gap-3">
        <PropertyThumb src={job.propertyImageUrl} alt={street} />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-base leading-snug font-semibold">{street}</p>
          {locality ? (
            <p className="text-muted-foreground mt-0.5 text-xs">{locality}</p>
          ) : null}
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3.5 shrink-0" />
          {formatScheduleWhen(job.scheduledTime || job.scheduledDate)}
        </span>
        <span className="inline-flex items-center gap-1">
          <InitialsAvatar name={profile.name} className="size-4 text-[8px]" />
          <span className="text-foreground font-medium">{profile.name}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-mono">
          <Hash className="size-3 shrink-0" />
          Job #{formatJobRefId(job.id)}
        </span>
      </div>

      <Button variant="outline" className="w-full" asChild>
        <a href={directionsHref} target="_blank" rel="noopener noreferrer">
          <Compass className="size-4 text-primary" />
          Directions
        </a>
      </Button>

      <div className="border-border border-t pt-3">
        <PayBreakdown
          hours={job.estimatedHours}
          laborAmount={job.laborAmount}
          durationLabel={job.durationLabel}
          label={job.status === 'completed' ? 'Fee' : 'Est. Fee'}
        />
      </div>
    </div>
  );
}
