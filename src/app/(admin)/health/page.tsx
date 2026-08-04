"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw, Server, Database, Clock, Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getHealth } from "@/lib/api/admin-client";
import type { HealthStatus } from "@/lib/api/types";

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${minutes} dakika`;
  return `${hours} saat ${minutes} dakika`;
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadHealth = useCallback(() => {
    getHealth()
      .then((data) => {
        setHealth(data);
        setError(null);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Veri yuklenemedi";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
        setLastRefresh(new Date());
      });
  }, []);

  useEffect(() => {
    loadHealth();
    const intervalId = window.setInterval(loadHealth, 15_000);
    return () => window.clearInterval(intervalId);
  }, [loadHealth]);

  if (loading) return <LoadingState message="Sistem durumu yukleniyor..." />;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Sistem Durumu</h1>
        </div>
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Sistem Durumu</h1>
        </div>
        <button
          onClick={loadHealth}
          className="flex items-center gap-2 px-3 py-2 rounded-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all text-[10px] font-sans uppercase tracking-widest"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Yenile
        </button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Backend Durumu */}
        <div className="glass-card rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Server className="w-4 h-4" />
            <span className="text-[10px] font-sans uppercase tracking-widest">Backend Durumu</span>
          </div>
          <div className="flex items-center gap-2">
            {health?.ok ? (
              <Badge variant="success">Calisiyor</Badge>
            ) : (
              <Badge variant="danger">Baglanti Hatasi</Badge>
            )}
          </div>
          <p className="text-[11px] text-gray-600 font-sans">{health?.service || "-"}</p>
        </div>

        {/* Supabase */}
        <div className="glass-card rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Database className="w-4 h-4" />
            <span className="text-[10px] font-sans uppercase tracking-widest">Supabase</span>
          </div>
          <div className="flex items-center gap-2">
            {health?.supabase?.connected ? (
              <Badge variant="success">
                Bagli ({health.supabase.latencyMs}ms)
              </Badge>
            ) : (
              <Badge variant="danger">Baglanti Hatasi</Badge>
            )}
          </div>
        </div>

        {/* Uptime */}
        <div className="glass-card rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-sans uppercase tracking-widest">Uptime</span>
          </div>
          <p className="text-lg text-white font-sans">
            {health?.uptimeSeconds != null ? formatUptime(health.uptimeSeconds) : "-"}
          </p>
        </div>

        {/* Node Sürümü */}
        <div className="glass-card rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Cpu className="w-4 h-4" />
            <span className="text-[10px] font-sans uppercase tracking-widest">Node Surumu</span>
          </div>
          <p className="text-lg text-white font-sans font-mono">
            {health?.nodeVersion || "-"}
          </p>
        </div>

        {/* Son Kontrol */}
        <div className="glass-card rounded-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-gray-400">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-sans uppercase tracking-widest">Son Kontrol</span>
          </div>
          <p className="text-sm text-white font-sans">
            {health?.timestamp
              ? new Date(health.timestamp).toLocaleString("tr-TR")
              : "-"}
          </p>
          <p className="text-[10px] text-gray-600 font-sans">
            Yerel: {lastRefresh.toLocaleTimeString("tr-TR")} (15s aralikla)
          </p>
        </div>
      </div>
    </div>
  );
}
