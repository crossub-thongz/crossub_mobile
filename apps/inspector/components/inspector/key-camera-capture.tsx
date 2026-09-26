'use client';

import { useCallback, useEffect, useRef, useState, type Touch, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';

import {
  INSPECTION_PHOTO_MAX_EDGE,
  compressCanvasToDataUrl,
} from '@/lib/compress-image';
import { cn } from '@/lib/utils';

type ZoomCaps = { min: number; max: number; step: number };

type LensOption = {
  id: string;
  label: string;
  deviceId?: string;
  zoom?: number;
  digital?: number;
};

type VideoCaps = MediaTrackCapabilities & {
  zoom?: { min: number; max: number; step?: number };
};

function readZoomCaps(track: MediaStreamTrack): ZoomCaps | null {
  try {
    const zoom = (track.getCapabilities() as VideoCaps).zoom;
    if (!zoom || typeof zoom.min !== 'number' || zoom.max <= zoom.min) return null;
    return { min: zoom.min, max: zoom.max, step: zoom.step || 0.1 };
  } catch {
    return null;
  }
}

async function applyTrackZoom(track: MediaStreamTrack, zoom: number) {
  try {
    await track.applyConstraints({ advanced: [{ zoom }] } as MediaTrackConstraints);
  } catch {
    try {
      await track.applyConstraints({ zoom } as unknown as MediaTrackConstraints);
    } catch {
      // Browser does not expose optical zoom.
    }
  }
}

function classifyCameraLabel(label: string): 'ultra' | 'tele' | 'wide' {
  const text = label.toLowerCase();
  if (/ultra|ultrawide|0\.5|wide.?angle/.test(text)) return 'ultra';
  if (/\btele(photo)?\b|\b2x\b|\b3x\b/.test(text)) return 'tele';
  return 'wide';
}

async function listRearCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter((device) => device.kind === 'videoinput');
  const rear = videos.filter((device) =>
    /back|rear|environment|ultra|tele|wide/i.test(device.label),
  );
  if (rear.length) return rear;
  return videos.filter((device) => !/front|user|face/i.test(device.label));
}

function buildLenses(
  cameras: MediaDeviceInfo[],
  zoom: ZoomCaps | null,
  currentDeviceId?: string,
): LensOption[] {
  const ultraCam = cameras.find((camera) => classifyCameraLabel(camera.label) === 'ultra');
  const teleCam = cameras.find((camera) => classifyCameraLabel(camera.label) === 'tele');
  const wideCam =
    cameras.find((camera) => classifyCameraLabel(camera.label) === 'wide') ??
    cameras.find((camera) => camera.deviceId === currentDeviceId) ??
    cameras[0];
  const sameCameraId = currentDeviceId;
  const lenses: LensOption[] = [];

  if (ultraCam) {
    lenses.push({ id: 'ultra', label: '0.5', deviceId: ultraCam.deviceId });
  } else if (zoom && zoom.min <= 0.7) {
    lenses.push({
      id: 'ultra',
      label: '0.5',
      deviceId: sameCameraId,
      zoom: zoom.min,
    });
  }

  lenses.push({
    id: 'wide',
    label: '1',
    deviceId: wideCam?.deviceId ?? sameCameraId,
    zoom: zoom ? Math.min(Math.max(1, zoom.min), zoom.max) : undefined,
    digital: zoom ? undefined : 1,
  });

  if (teleCam) {
    lenses.push({ id: 'tele', label: '2', deviceId: teleCam.deviceId });
  } else if (zoom && zoom.max >= 1.8) {
    lenses.push({
      id: 'tele',
      label: '2',
      deviceId: sameCameraId,
      zoom: Math.min(2, zoom.max),
    });
  } else if (!zoom) {
    lenses.push({ id: 'tele', label: '2', digital: 2 });
  }

  if (!lenses.some((lens) => lens.id === 'ultra') && cameras.length >= 2) {
    const other = cameras.find((camera) => camera.deviceId !== (wideCam?.deviceId ?? sameCameraId));
    if (other) {
      lenses.unshift({ id: 'ultra', label: '0.5', deviceId: other.deviceId });
    }
  }

  return lenses;
}

function touchDistance(a: Touch, b: Touch) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function KeyCameraCapture({
  open,
  onClose,
  onCapture,
  onBurstComplete,
  captureMode = 'single',
  nativeInputId,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onBurstComplete?: (dataUrls: string[]) => void;
  captureMode?: 'single' | 'burst';
  nativeInputId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [burstShots, setBurstShots] = useState<string[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [lenses, setLenses] = useState<LensOption[]>([]);
  const [activeLens, setActiveLens] = useState('wide');
  const [zoomCaps, setZoomCaps] = useState<ZoomCaps | null>(null);
  const [hardwareZoom, setHardwareZoom] = useState(1);
  const [digitalZoom, setDigitalZoom] = useState(1);

  const stopStream = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
      try {
        video.load();
      } catch {
        // iOS still holds the camera if srcObject is left attached.
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const attachStream = useCallback(async (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return false;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.srcObject = stream;
    try {
      await video.play();
      if (video.videoWidth === 0) return false;
      setReady(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopStream();
      setError(null);
      setBurstShots([]);
      setDeviceId(undefined);
      setLenses([]);
      setActiveLens('wide');
      setZoomCaps(null);
      setHardwareZoom(1);
      setDigitalZoom(1);
      return;
    }

    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not available here. Use Upload to pick a photo you have already taken.');
        return;
      }
      stopStream();
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      if (cancelled) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        const zoom = track ? readZoomCaps(track) : null;
        const cameras = await listRearCameras();
        const currentId = track?.getSettings().deviceId;
        if (!cancelled) {
          setZoomCaps(zoom);
          setLenses(buildLenses(cameras, zoom, currentId));
          if (zoom) {
            const settings = track.getSettings() as { zoom?: number };
            setHardwareZoom(settings.zoom ?? Math.min(Math.max(1, zoom.min), zoom.max));
          }
        }
        for (let attempt = 0; attempt < 8; attempt += 1) {
          if (cancelled) return;
          if (await attachStream(stream)) return;
          await new Promise((resolve) => window.setTimeout(resolve, 50));
        }
        if (!cancelled) {
          stopStream();
          setError(
            'Camera preview did not start. Use Phone camera or Upload to add photos you have already taken.',
          );
        }
      } catch {
        setError(
          'Could not open the camera. Allow camera access in browser settings, or use Phone camera / Upload.',
        );
      }
    };

    void start();

    const watchdog = window.setTimeout(() => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.videoWidth > 0) return;
      stopStream();
      setError(
        'Camera preview did not start. Use Phone camera or Upload to add photos you have already taken.',
      );
    }, 3500);

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      stopStream();
    };
  }, [attachStream, deviceId, open, stopStream]);

  const setCombinedZoom = useCallback(
    async (next: number) => {
      const track = streamRef.current?.getVideoTracks()[0];
      if (zoomCaps && track) {
        const clamped = Math.min(zoomCaps.max, Math.max(zoomCaps.min, next));
        setHardwareZoom(clamped);
        setDigitalZoom(1);
        await applyTrackZoom(track, clamped);
        return;
      }
      setDigitalZoom(Math.min(4, Math.max(1, next)));
    },
    [zoomCaps],
  );

  const selectLens = async (lens: LensOption) => {
    setActiveLens(lens.id);
    if (lens.deviceId && lens.deviceId !== streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId) {
      setDigitalZoom(lens.digital ?? 1);
      setDeviceId(lens.deviceId);
      return;
    }
    if (typeof lens.zoom === 'number') {
      await setCombinedZoom(lens.zoom);
      return;
    }
    setDigitalZoom(lens.digital ?? 1);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    const maxEdge = INSPECTION_PHOTO_MAX_EDGE;
    const longest = Math.max(video.videoWidth, video.videoHeight);
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const crop = digitalZoom > 1.01 ? digitalZoom : 1;
    const sw = video.videoWidth / crop;
    const sh = video.videoHeight / crop;
    const sx = (video.videoWidth - sw) / 2;
    const sy = (video.videoHeight - sh) / 2;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const dataUrl = compressCanvasToDataUrl(canvas);
    if (captureMode === 'burst') {
      setBurstShots((prev) => [...prev, dataUrl]);
      return;
    }
    onCapture(dataUrl);
    stopStream();
    onClose();
  };

  const finishBurst = () => {
    if (burstShots.length === 0) return;
    onBurstComplete?.(burstShots);
    stopStream();
    onClose();
  };

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    const current = zoomCaps ? hardwareZoom : digitalZoom;
    pinchRef.current = {
      distance: touchDistance(event.touches[0], event.touches[1]),
      zoom: current,
    };
  };

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !pinchRef.current) return;
    event.preventDefault();
    const distance = touchDistance(event.touches[0], event.touches[1]);
    const ratio = distance / Math.max(1, pinchRef.current.distance);
    void setCombinedZoom(pinchRef.current.zoom * ratio);
  };

  const onTouchEnd = () => {
    pinchRef.current = null;
  };

  if (!open || typeof document === 'undefined') return null;

  const zoomLabel = zoomCaps
    ? `${hardwareZoom.toFixed(hardwareZoom >= 10 ? 0 : 1)}×`
    : digitalZoom > 1.01
      ? `${digitalZoom.toFixed(1)}×`
      : null;

  const closeCamera = () => {
    stopStream();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex h-[100dvh] w-full flex-col bg-black">
      <button
        type="button"
        onClick={closeCamera}
        className="absolute top-4 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-black/45 text-white shadow-lg backdrop-blur-sm"
        aria-label="Close camera"
      >
        <X className="size-8" strokeWidth={2.25} />
      </button>

      {nativeInputId ? (
        <label
          htmlFor={nativeInputId}
          onClick={closeCamera}
          className="absolute top-5 left-4 z-30 rounded-full bg-black/45 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm"
        >
          Phone camera
        </label>
      ) : null}

      <div
        className="relative min-h-0 flex-1 touch-none overflow-hidden pt-14"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
          className={cn('h-full w-full object-contain', error && 'invisible')}
          style={
            digitalZoom > 1.01
              ? { transform: `scale(${digitalZoom})`, transformOrigin: 'center center' }
              : undefined
          }
        />
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 px-6 text-center">
            <p className="text-sm text-white/80">{error}</p>
            {nativeInputId ? (
              <label
                htmlFor={nativeInputId}
                onClick={closeCamera}
                className="inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Open phone camera
              </label>
            ) : null}
          </div>
        ) : null}

        {!error && lenses.length > 1 ? (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full bg-black/45 p-1 backdrop-blur-sm">
            {lenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => void selectLens(lens)}
                className={cn(
                  'min-w-10 rounded-full px-3 py-1.5 text-xs font-semibold text-white',
                  activeLens === lens.id ? 'bg-white text-black' : 'text-white/85',
                )}
              >
                {lens.label}×
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!error ? (
        <div className="relative z-20 shrink-0 bg-gradient-to-t from-black via-black/90 to-transparent px-4 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          {zoomCaps && zoomCaps.max - zoomCaps.min >= 0.5 ? (
            <div className="mb-3 flex items-center gap-3">
              <span className="w-10 text-xs text-white/70">{zoomCaps.min.toFixed(1)}×</span>
              <input
                type="range"
                min={zoomCaps.min}
                max={zoomCaps.max}
                step={zoomCaps.step || 0.1}
                value={hardwareZoom}
                onChange={(event) => void setCombinedZoom(Number(event.target.value))}
                className="flex-1 accent-[#00d4a4]"
                aria-label="Zoom"
              />
              <span className="w-10 text-right text-xs text-white/70">
                {zoomCaps.max >= 10 ? `${Math.round(zoomCaps.max)}×` : `${zoomCaps.max.toFixed(1)}×`}
              </span>
            </div>
          ) : null}
          {captureMode === 'burst' && burstShots.length > 0 ? (
            <ul className="mb-3 flex gap-2 overflow-x-auto">
              {burstShots.map((url, index) => (
                <li
                  key={`${url.slice(-12)}-${index}`}
                  className="relative size-14 shrink-0 overflow-hidden rounded-md border border-white/40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Shot ${index + 1}`} className="size-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center justify-center gap-6">
            {captureMode === 'burst' ? (
              <button
                type="button"
                disabled={burstShots.length === 0}
                onClick={finishBurst}
                className="flex min-w-20 flex-col items-center gap-1 text-white disabled:opacity-40"
              >
                <span className="flex size-12 items-center justify-center rounded-full bg-white/15">
                  <Check className="size-6" />
                </span>
                <span className="text-xs">
                  {burstShots.length === 0
                    ? 'Use photos'
                    : `Use ${burstShots.length} photo${burstShots.length === 1 ? '' : 's'}`}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={!ready}
              onClick={capture}
              aria-label="Capture photo"
              className={cn(
                'mb-2 flex size-[4.75rem] items-center justify-center rounded-full border-4 border-white/95 bg-[#00d4a4] shadow-[0_4px_24px_rgba(0,212,164,0.5)] transition-transform active:scale-95',
                !ready && 'opacity-70',
              )}
            >
              <span className="size-[3.25rem] rounded-full bg-[#00d4a4] ring-2 ring-white/50" />
            </button>
            {captureMode === 'burst' ? (
              <span className="min-w-20 text-center text-xs text-white/70">
                {zoomLabel ?? 'Pinch to zoom'}
              </span>
            ) : null}
          </div>
          {captureMode === 'burst' ? (
            <p className="mt-2 text-center text-xs text-white/70">
              Snap as many as you need. Use 0.5× / 1× / 2× if your phone exposes them, then Use photos.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
