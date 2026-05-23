"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Bell,
  Building2,
  CheckCheck,
  MessageSquare,
  UserPlus,
} from "lucide-react";

function NotificationPanel({
  onClose,
  bellRef,
}: {
  onClose: () => void;
  bellRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("dashboard.header");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const clickedBell = bellRef.current?.contains(target);

      if (clickedBell) return;

      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, bellRef]);

  const DUMMY_NOTIFICATIONS = [
    {
      id: "1",
      icon: UserPlus,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-400/10",
      title: t("projectInvite"),
      description: (
        <>
          <span className="text-gray-300">Ahmet Yılmaz</span> {t("dummyInvitePrefix")}{" "}
          <span className="text-primary">&quot;Villa Projesi&quot;</span>{" "}
          {t("dummyInvite")}
        </>
      ),
      time: t("minutesAgoShort", { count: 2 }),
    },
    {
      id: "2",
      icon: MessageSquare,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-400/10",
      title: t("comment"),
      description: (
        <>
          <span className="text-gray-300">Zeynep K.</span>{" "}
          {t("dummyComment")}
        </>
      ),
      time: t("hoursAgo", { count: 1 }),
    },
    {
      id: "3",
      icon: Building2,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-400/10",
      title: t("workspace"),
      description: t("dummyWorkspaceCredit"),
      time: t("hoursAgo", { count: 3 }),
    },
  ];

  return (
    <motion.div
      ref={panelRef}
      id="notification-panel"
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-2 w-80 bg-[#0d0f13] border border-white/10 rounded-sm shadow-2xl overflow-hidden z-50"
      style={{ maxHeight: "420px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <p className="text-xs font-sans font-bold text-white uppercase tracking-widest">
          {t("notifications")}
        </p>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] font-sans text-gray-600 hover:text-primary transition-colors uppercase tracking-wider"
        >
          <CheckCheck className="w-3 h-3" /> {t("markAllRead")}
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: "356px" }}>
        {DUMMY_NOTIFICATIONS.map((notif) => {
          const Icon = notif.icon;

          return (
            <div
              key={notif.id}
              className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-full ${notif.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                >
                  <Icon className={`w-3.5 h-3.5 ${notif.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-sans text-white font-medium leading-snug">
                    {notif.title}
                  </p>
                  <p className="text-[10px] font-sans text-gray-500 leading-relaxed mt-0.5">
                    {notif.description}
                  </p>
                  <p className="text-[9px] text-gray-700 mt-1">{notif.time}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/5 text-center">
        <button
          type="button"
          className="text-[10px] font-sans text-gray-600 hover:text-primary transition-colors uppercase tracking-wider"
        >
          {t("viewAllNotifications")}
        </button>
      </div>
    </motion.div>
  );
}

export default function NotificationBell() {
  const t = useTranslations("dashboard.header");
  const [notifOpen, setNotifOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={bellContainerRef} className="relative">
      <button
        type="button"
        onClick={() => setNotifOpen((prev) => !prev)}
        aria-label={t("notifications")}
        aria-expanded={notifOpen}
        aria-controls="notification-panel"
        className={`relative w-8 h-8 flex items-center justify-center rounded-sm transition-colors ${
          notifOpen
            ? "bg-primary/10 text-primary"
            : "text-gray-500 hover:text-white hover:bg-white/5"
        }`}
      >
        <Bell className="w-4 h-4" />
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-black text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
          3
        </span>
      </button>

      <AnimatePresence>
        {notifOpen && (
          <NotificationPanel
            onClose={() => setNotifOpen(false)}
            bellRef={bellContainerRef}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
