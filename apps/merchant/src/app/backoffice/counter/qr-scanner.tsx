"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/** Minimal shape of the native BarcodeDetector (not in lib.dom). */
type DetectedBarcode = { rawValue: string };
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}

async function decodeFrame(
  video: HTMLVideoElement,
  detector: BarcodeDetectorLike | null,
  canvas: HTMLCanvasElement | null,
): Promise<string | null> {
  if (detector) {
    try {
      const codes = await detector.detect(video);
      const value = codes.find((c) => c.rawValue)?.rawValue;
      if (value) return value;
    } catch {
      // Fall through to the JS decoder.
    }
  }
  if (!canvas) return null;
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const result = jsQR(image.data, width, height, {
    inversionAttempts: "dontInvert",
  });
  return result?.data ?? null;
}

/**
 * Camera QR scanner (spec 0030): native `BarcodeDetector` when available, JS `jsQR`
 * fallback otherwise. Fires `onDecode` once per mount; the parent pauses it (unmount)
 * after a hit. Requires HTTPS (`getUserMedia`). Stops all tracks on cleanup.
 */
export function QrScanner({ onDecode }: { onDecode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    let detector: BarcodeDetectorLike | null = null;
    let fired = false;

    async function scan() {
      if (stopped || fired) return;
      const video = videoRef.current;
      if (video && video.readyState >= video.HAVE_CURRENT_DATA) {
        const text = await decodeFrame(video, detector, canvasRef.current);
        if (text && !fired) {
          fired = true;
          onDecodeRef.current(text);
          return;
        }
      }
      raf = requestAnimationFrame(() => void scan());
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => undefined);
        const ctor = (
          window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }
        ).BarcodeDetector;
        if (ctor) {
          try {
            detector = new ctor({ formats: ["qr_code"] });
          } catch {
            detector = null;
          }
        }
        void scan();
      } catch {
        setError(
          "No pudimos abrir la cámara. Revisá los permisos del navegador.",
        );
      }
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (error) {
    return <p className="counter-scan-error">{error}</p>;
  }
  return (
    <div className="counter-scanner">
      <video ref={videoRef} className="counter-video" muted playsInline />
      <div className="counter-reticle" aria-hidden />
      <canvas ref={canvasRef} hidden />
      <p className="counter-scan-hint">Apuntá al código QR del cliente</p>
    </div>
  );
}
