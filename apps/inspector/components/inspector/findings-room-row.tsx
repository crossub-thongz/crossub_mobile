'use client';

import { ProofPhotoGallery } from '@/components/inspector/proof-photo-gallery';
import type { RoomInspectionEntry } from '@/lib/types';

function SidePhoto({
  label,
  urls,
  area,
}: {
  label: string;
  urls: string[];
  area: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {urls.length > 0 ? (
        <ProofPhotoGallery
          photos={urls.map((url, index) => ({
            label: `${area} · ${label} · ${index + 1}`,
            url,
          }))}
          emptyLabel={`No ${label.toLowerCase()} photo`}
        />
      ) : (
        <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed px-2 text-center text-xs text-muted-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

export function FindingsRoomRow({ room }: { room: RoomInspectionEntry }) {
  const isBeforeAfter =
    (room.ingoingPhotoUrls?.length ?? 0) > 0 ||
    (room.outgoingPhotoUrls?.length ?? 0) > 0;

  return (
    <div className="space-y-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {isBeforeAfter ? `${room.area} — Before / After` : room.area}
        </p>
        {room.condition ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {room.condition}
          </span>
        ) : null}
      </div>

      {room.comments ? (
        <p className="text-muted-foreground text-xs">{room.comments}</p>
      ) : null}

      {isBeforeAfter ? (
        <div className="grid grid-cols-2 gap-3">
          <SidePhoto
            label="Entry"
            urls={room.ingoingPhotoUrls ?? []}
            area={room.area}
          />
          <SidePhoto
            label="Final"
            urls={room.outgoingPhotoUrls ?? []}
            area={room.area}
          />
        </div>
      ) : room.photoUrls.length > 0 ? (
        <ProofPhotoGallery
          photos={room.photoUrls.map((url, index) => ({
            label: `${room.area} · ${index + 1}`,
            url,
          }))}
          emptyLabel="No photos for this area"
        />
      ) : null}
    </div>
  );
}
