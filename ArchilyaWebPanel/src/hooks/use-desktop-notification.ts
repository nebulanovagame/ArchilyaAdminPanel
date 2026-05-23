"use client";

import { useCallback, useRef, useState } from "react";

interface DesktopNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

const NOTIFICATION_SOUND_DURATION_SECONDS = 0.18;
const NOTIFICATION_SOUND_FREQUENCY = 880;
const NOTIFICATION_SOUND_SAMPLE_RATE = 8000;

function createNotificationSoundDataUri() {
  const totalSamples = Math.max(1, Math.floor(NOTIFICATION_SOUND_SAMPLE_RATE * NOTIFICATION_SOUND_DURATION_SECONDS));
  const pcmBytes = new Uint8Array(totalSamples);

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const time = sampleIndex / NOTIFICATION_SOUND_SAMPLE_RATE;
    const envelope = 1 - (sampleIndex / totalSamples);
    const wave = Math.sin(2 * Math.PI * NOTIFICATION_SOUND_FREQUENCY * time);
    pcmBytes[sampleIndex] = Math.max(0, Math.min(255, Math.round(128 + (wave * 90 * envelope))));
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataLength = pcmBytes.length;

  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + dataLength, true);
  view.setUint32(8, 0x57415645, false);
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, NOTIFICATION_SOUND_SAMPLE_RATE, true);
  view.setUint32(28, NOTIFICATION_SOUND_SAMPLE_RATE, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, dataLength, true);

  const wavBytes = new Uint8Array(header.byteLength + pcmBytes.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBytes, header.byteLength);

  let binary = "";
  wavBytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });

  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function useDesktopNotification() {
  const soundDataUriRef = useRef<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    if (!("Notification" in window)) return "denied";
    return window.Notification.permission;
  });

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("denied");
      return "denied" satisfies NotificationPermission;
    }

    const currentPermission = window.Notification.permission;
    if (currentPermission !== "default") {
      setPermission(currentPermission);
      return currentPermission;
    }

    const nextPermission = await window.Notification.requestPermission();
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  const notify = useCallback(async ({ title, body, icon, tag }: DesktopNotificationOptions) => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    const nextPermission = window.Notification.permission === "default"
      ? await requestPermission()
      : window.Notification.permission;

    setPermission(nextPermission);
    if (nextPermission !== "granted") {
      return;
    }

    new window.Notification(title, {
      body,
      icon,
      tag,
    });

    if (typeof window === "undefined") {
      return;
    }

    if (!soundDataUriRef.current) {
      soundDataUriRef.current = createNotificationSoundDataUri();
    }

    const soundDataUri = soundDataUriRef.current;
    if (!soundDataUri) {
      return;
    }

    const audio = new Audio(soundDataUri);
    audio.volume = 0.35;
    audio.addEventListener("ended", () => audio.remove(), { once: true });

    try {
      await audio.play();
    } catch {
      audio.remove();
      // Ignore autoplay or device audio failures.
    }
  }, [requestPermission]);

  return {
    requestPermission,
    notify,
    permission,
  };
}
