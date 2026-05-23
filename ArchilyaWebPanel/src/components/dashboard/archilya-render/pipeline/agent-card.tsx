"use client";

import { Bot, Brain, CheckCircle2, Clock, Cpu, Eye, Hammer, Palette, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AgentRole, AgentState } from "@/lib/types/agent";

type AgentCardProps = {
  agent: AgentState;
  isActive: boolean;
};

const roleMeta: Record<AgentRole, { key: string; color: string; icon: typeof Bot }> = {
  ORCHESTRATOR: { key: "agents.orchestrator", color: "#6C63FF", icon: Brain },
  ANALYST: { key: "agents.analyst", color: "#3B82F6", icon: Eye },
  MATERIAL: { key: "agents.material", color: "#FFA502", icon: Palette },
  RENDER: { key: "agents.render", color: "#2ED573", icon: Cpu },
  QC: { key: "agents.qc", color: "#FACC15", icon: CheckCircle2 },
  REVISION: { key: "agents.revision", color: "#FF4757", icon: RotateCcw },
};

export default function AgentCard({ agent, isActive }: AgentCardProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const meta = roleMeta[agent.role];
  const Icon = meta.icon;
  const lastMessage = agent.messages.at(-1)?.content ?? agent.currentTask ?? t("pipeline.waiting");
  const isThinking = agent.status === "THINKING";

  return (
    <div
      className="rounded-sm border border-white/10 bg-[#1A1A2E] p-4 transition-all"
      style={{ boxShadow: isActive ? "0 0 20px #6C63FF44" : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border" style={{ borderColor: `${meta.color}66`, color: meta.color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{t(meta.key)}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{agent.role}</p>
          </div>
        </div>
        <span className="rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-widest" style={{ borderColor: `${meta.color}66`, color: meta.color }}>
          {agent.status}
        </span>
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-relaxed text-gray-400">{lastMessage}</p>
      {isThinking && (
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: meta.color, animationDelay: `${dot * 120}ms` }} />
          ))}
        </div>
      )}

      <div className="mt-4 h-2 overflow-hidden rounded-sm bg-white/10">
        <div className="h-full transition-all" style={{ width: `${agent.progress}%`, backgroundColor: meta.color }} />
      </div>
      <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
        {agent.status === "WAITING" ? <Clock className="h-3 w-3" /> : <Hammer className="h-3 w-3" />}
        {agent.progress}/100
      </div>
    </div>
  );
}
