"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export type ShortcutAction =
  | "navigate-ai-studio"
  | "open-shortcuts-help"
  | "close-modal";

const SHORTCUTS: Array<{
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: ShortcutAction;
  labelKey: string;
}> = [
  { key: "a", ctrl: true, shift: true, action: "navigate-ai-studio", labelKey: "navigateAiStudio" },
  { key: "k", ctrl: true, action: "open-shortcuts-help", labelKey: "openHelp" },
  { key: "Escape", action: "close-modal", labelKey: "closeModal" },
];

function isInputElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input"
    || tag === "textarea"
    || tag === "select"
    || target.isContentEditable
  );
}

export function useKeyboardShortcuts(
  onAction: (action: ShortcutAction) => void,
) {
  const t = useTranslations("dashboard.shortcuts");
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isInputElement(event.target)) return;

      for (const shortcut of SHORTCUTS) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          onAction(shortcut.action);
          return;
        }
      }
    },
    [onAction],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const shortcuts = SHORTCUTS.map((shortcut) => ({
    ...shortcut,
    label: t(shortcut.labelKey),
  }));

  return { shortcuts };
}

export function useShortcutsModal() {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);
  return { open, openModal, closeModal };
}
