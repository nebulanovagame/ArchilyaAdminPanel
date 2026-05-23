"use client";

import AgentCard from "@/components/dashboard/archilya-render/pipeline/agent-card";
import { useTranslations } from "next-intl";
import { usePipelineContext } from "@/stores/pipeline-store";

export default function AgentCouncilMonitor() {
  const t = useTranslations("dashboard.archilyaRender");
  const { jobState } = usePipelineContext();
  const agents = jobState?.agents ?? [];
  const messages = agents.flatMap((agent) => agent.messages).sort((a, b) => b.timestamp - a.timestamp);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <AgentCard
            key={agent.role}
            agent={agent}
            isActive={agent.status === "THINKING" || agent.status === "WORKING"}
          />
        ))}
      </div>

      <div className="rounded-sm border border-white/10 bg-[#0d0f13] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#6C63FF]">
          {t("pipeline.liveMessageStream")}
        </p>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-xs text-gray-500">{t("pipeline.councilNotSpoken")}</p>
          ) : (
            messages.map((message) => (
              <div key={`${message.agentRole}-${message.timestamp}-${message.content}`} className="rounded-sm border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{message.agentRole} · {message.type}</p>
                <p className="mt-1 text-xs text-gray-300">{message.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
