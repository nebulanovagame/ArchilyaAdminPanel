"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Command, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";

import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShortcutsHelpModal({ open, onClose }: ShortcutsHelpModalProps) {
  const { shortcuts } = useKeyboardShortcuts(() => {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            aria-describedby="shortcuts-desc"
            className="w-full max-w-md mx-4 bg-[#0d0f13] border border-white/10 rounded-sm overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Command className="w-4 h-4 text-primary" />
                <h2 id="shortcuts-title" className="text-sm font-serif text-white italic">Klavye Kısayolları</h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between gap-4">
                  <span className="text-xs text-gray-400 font-sans">{shortcut.label}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {shortcut.ctrl && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium text-gray-300 bg-white/5 border border-white/10 rounded-sm">
                        Ctrl
                      </kbd>
                    )}
                    {shortcut.shift && (
                      <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium text-gray-300 bg-white/5 border border-white/10 rounded-sm">
                        Shift
                      </kbd>
                    )}
                    <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-medium text-gray-300 bg-white/5 border border-white/10 rounded-sm uppercase">
                      {shortcut.key === "Escape" ? "Esc" : shortcut.key}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>

            <div id="shortcuts-desc" className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
              <p className="text-[10px] text-gray-600 font-sans">
                Kısayollar metin alanlarına odaklandığınızda devre dışı kalır.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
