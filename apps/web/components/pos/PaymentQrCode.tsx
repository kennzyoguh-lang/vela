"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface PaymentQrCodeProps {
  value: string;
  label: string;
}

// Quick Sale / Instant Collect Piece 3 — a dynamic QR encoding the payment
// link, scannable by any banking app (no Vela-specific reader needed, same
// as the SMS link in Piece 4 — both just point at the existing /pay/:token
// portal). Generation happens entirely client-side (the "qrcode" package's
// browser build, no network round-trip) since the link itself is already
// known once the Quick Sale invoice is created. Degrades quietly on any
// failure — same stance as VoiceInputButton's speech-recognition
// feature-detection — the copy-link button on this same screen is always
// available as a fallback, so a QR failure must never block collection.
export function PaymentQrCode({ value, label }: PaymentQrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        // No QR available — the copy-link button still works, so skip silently.
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) return null;

  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4">
      <img src={dataUrl} alt={label} width={220} height={220} />
    </div>
  );
}
