'use client';

import { memo, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Car,
  Clock,
  DoorOpen,
  Home,
  MapPin,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import {
  CORE_INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
  type CoreInspectionType,
} from '@/constants/inspection';
import { inspectionsByType, jobDetail } from '@/constants/routes';
import { writeLastInspectionsType } from '@/lib/inspections-list-prefs';
import { isPoolJob } from '@/lib/inspector-job-filters';
import { POOL_TYPE_ACCENT } from '@/lib/pool-type-accent';
import { propertyAddressLines } from '@/lib/property-address';
import type { GeoPoint } from '@/lib/travel';
import { computeTravelEstimate, formatDistanceKm } from '@/lib/travel';
import type { InspectionJob } from '@/lib/types';
import { cn, formatCurrency, formatDate, formatTime } from '@/lib/utils';

const TYPE_ICON = {
  routine: Home,
  open: Users,
  ingoing: DoorOpen,
  outgoing: DoorOpen,
  tribunal: Home,
} as const;

export const JobCard = memo(function JobCard({
  job,
  showActions,
  origin,
}: {
  job: InspectionJob;
  /** Pool list — tap through to preview before accepting. */
  showActions?: boolean;
  origin?: GeoPoint | null;
}) {
  const { receivingJobs, acceptJob } = useInspectorData();
  const deviceLocation = useDeviceLocation();
  const [accepting, setAccepting] = useState(false);
  const poolPreview = Boolean(showActions && isPoolJob(job));
  const detailHref = jobDetail(job.id);
  const from = origin ?? deviceLocation;
  const destination =
    job.latitude != null && job.longitude != null
      ? { latitude: job.latitude, longitude: job.longitude }
      : null;
  const travel = computeTravelEstimate(from, destination);
  const { street, locality } = propertyAddressLines(job);
  const accent = POOL_TYPE_ACCENT[job.type];
  const TypeIcon = TYPE_ICON[job.type];
  const typeLabel =
    job.type in INSPECTION_TYPE_LABEL
      ? INSPECTION_TYPE_LABEL[job.type as CoreInspectionType]
      : job.type.toUpperCase();
  const timeLabel = formatTime(job.scheduledTime).replace(/\b(am|pm)\b/gi, (part) =>
    part.toUpperCase(),
  );

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const result = await acceptJob(job.id);
      if (!result) return;
      if (CORE_INSPECTION_TYPES.includes(job.type as CoreInspectionType)) {
        writeLastInspectionsType(job.type as CoreInspectionType);
      }
      if (result.awaitingAgentPayment) {
        window.location.assign(detailHref);
        return;
      }
      window.location.assign(inspectionsByType(job.type));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <article className="border-border/80 bg-card rounded-2xl border p-3.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-[4.25rem] shrink-0 flex-col items-center justify-center rounded-xl border',
            accent.border,
          )}
        >
          <TypeIcon className={cn('size-6', accent.icon)} />
          <span className={cn('mt-1 text-[9px] font-bold tracking-wide', accent.text)}>
            {typeLabel}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-foreground text-sm leading-snug font-semibold">
                {street}
              </p>
              {locality ? (
                <p className="text-muted-foreground mt-0.5 text-xs">{locality}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-lg font-bold leading-none tabular-nums', accent.fee)}>
                {formatCurrency(job.laborAmount)}
              </p>
              <p className="text-muted-foreground mt-1 text-[9px] font-medium uppercase tracking-wide">
                Est. Fee
              </p>
            </div>
          </div>

          <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 shrink-0" />
              {formatDate(job.scheduledDate || job.scheduledTime)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {travel ? formatDistanceKm(travel.distanceKm) : '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              {timeLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Car className="size-3 shrink-0" />
              {travel ? `${travel.travelMinutes} min away` : '—'}
            </span>
            <span className="col-span-2 inline-flex items-center gap-1">
              <Clock className="size-3 shrink-0" />
              {job.durationLabel}
            </span>
          </div>
        </div>
      </div>

      {poolPreview ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button asChild variant="outline" className="h-9">
            <a
              href={detailHref}
              onClick={
                receivingJobs
                  ? (event) => {
                      event.preventDefault();
                      window.location.assign(detailHref);
                    }
                  : undefined
              }
            >
              View Details
            </a>
          </Button>
          <Button
            type="button"
            className="h-9 bg-emerald-500 text-black hover:bg-emerald-400"
            disabled={accepting || !receivingJobs}
            onClick={() => void handleAccept()}
          >
            {accepting ? 'Accepting…' : 'Accept Job'}
          </Button>
        </div>
      ) : (
        <Link
          href={detailHref}
          className="text-primary mt-3 flex items-center justify-center text-xs font-medium"
        >
          View details
        </Link>
      )}
    </article>
  );
});
