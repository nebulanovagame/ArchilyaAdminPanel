"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

type VolumeLockBadgeProps = {
  timestamp: number;
};

export default function VolumeLockBadge({ timestamp }: VolumeLockBadgeProps) {
  const t = useTranslations("dashboard.archilyaRender");
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-2 rounded-sm border border-[#2ED573]/40 bg-[#2ED573]/10 px-3 py-2 text-[#2ED573]"
    >
      <Lock className="h-4 w-4" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest">{t("spatial.massLocked")}</p>
        <p className="text-[10px] text-[#2ED573]/70">
          {new Date(timestamp).toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </motion.div>
  );
}
