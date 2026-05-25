"use client";

import { useRouter } from "next/navigation";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import ShortcutsHelpModal from "@/components/shortcuts-help-modal";
import { useShortcutsModal } from "@/hooks/use-keyboard-shortcuts";

export default function KeyboardShortcutsHandler() {
  const router = useRouter();
  const { open, openModal, closeModal } = useShortcutsModal();

  useKeyboardShortcuts((action) => {
    switch (action) {
      case "navigate-ai-studio":
        router.push("/ai-studio");
        break;
      case "open-shortcuts-help":
        openModal();
        break;
      case "close-modal":
        closeModal();
        break;
    }
  });

  return <ShortcutsHelpModal open={open} onClose={closeModal} />;
}
