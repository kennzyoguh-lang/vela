"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

// Minimal ambient typing for the Web Speech API — no @types package covers
// this, and it's non-standard enough that TypeScript's lib.dom doesn't
// include it either.
interface SpeechRecognitionResultLike {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface VoiceInputButtonProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * The optional "+ name" affordance — auto-starts listening the moment it's
 * tapped (mic-first, not reveal-a-field-then-tap-a-separate-mic-button), so
 * using it costs exactly one extra tap on top of the default sale-logging
 * path. Feature-detects the Web Speech API and hides the mic entirely if
 * unsupported, falling back to a plain text input — Igbo (ig-NG) speech
 * recognition support is inconsistent across browsers/OS today, this is a
 * real capability risk, not a guarantee, so silent degradation matters more
 * than the voice path itself.
 */
export function VoiceInputButton({ value, onChange }: VoiceInputButtonProps) {
  const { t, language } = useTranslation();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  function startListening() {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language === "ig" ? "ig-NG" : "en-NG";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onChange(transcript);
    };
    recognition.onerror = () => setSupported(false); // degrade to the text field below, no error shown
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  if (value) {
    return (
      <div className="bg-surface-secondary flex items-center gap-2 rounded-full px-4 py-2">
        <span className="font-ui text-text-primary text-[0.875rem]">{value}</span>
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear name"
          className="text-text-secondary"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  if (!supported) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("pos.sell.addName")}
        className="bg-surface-secondary text-text-primary font-ui rounded-full px-4 py-2 text-[0.875rem]"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startListening}
      disabled={listening}
      className={cn(
        "font-ui flex items-center gap-2 rounded-full px-4 py-2 text-[0.875rem] font-semibold",
        listening ? "bg-gold text-midnight" : "bg-surface-secondary text-text-primary",
      )}
    >
      <Mic className="size-4" aria-hidden />
      {listening ? t("pos.sell.listening") : t("pos.sell.addName")}
    </button>
  );
}
