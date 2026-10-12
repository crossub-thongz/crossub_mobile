'use client';

import { Calendar, Hash, Send } from 'lucide-react';

import { InitialsAvatar } from '@/components/inspector/initials-avatar';
import { JobTravelInfo } from '@/components/inspector/job-travel-info';
import { PayBreakdown } from '@/components/inspector/pay-breakdown';
import { PropertyThumb } from '@/components/inspector/property-thumb';
import { JobTypeBadge } from '@/components/inspector/status-badge';
import { Button } from '@/components/ui/button';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import { formatJobRefId } from '@/lib/job-cancellation';
import { buildMapUrl } from '@/lib/navigation';
import { propertyAddressLines } from '@/lib/property-address';
import type { InspectionJob } from '@/lib/types';
import { formatScheduleWhen } from '@/lib/utils';

export function JobSummaryCard({
  job,
  showPayout = true,
}: {
  job: InspectionJob;
  showPayout?: boolean;
}) {
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
      <div className="flex items-start gap-3">
        <PropertyThumb src={job.propertyImageUrl} alt={street} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-sm leading-snug font-semibold">{street}</p>
              {locality ? (
                <p className="text-muted-foreground mt-0.5 text-xs">{locality}</p>
              ) : null}
            </div>
            <JobTypeBadge type={job.type} />
          </div>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3 shrink-0" />
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
          <Send className="size-3.5" />
          Directions
        </a>
      </Button>

      <JobTravelInfo job={job} deviceLocation={deviceLocation} />

      {showPayout && (
        <div className="border-border border-t pt-3">
          <p className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wide">
            Job payout
          </p>
          <PayBreakdown
            hours={job.estimatedHours}
            laborAmount={job.laborAmount}
            durationLabel={job.durationLabel}
          />
        </div>
      )}
    </div>
  );
}
