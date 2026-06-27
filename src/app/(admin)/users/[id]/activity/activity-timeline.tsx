"use client";

import { useState } from "react";
import type { ComponentType } from "react";
import { CheckCircle2, Clock, Coins, FileImage, ImagePlus, Images, Settings, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UserActivityEntry } from "@/lib/api/types";

type ActivityTypeConfig = {
  readonly label: string;
  readonly variant: "success" | "danger" | "info" | "warning" | "neutral";
  readonly icon: ComponentType<{ readonly className?: string }>;
};

const TYPE_CONFIG: Record<string, ActivityTypeConfig> = {
  ai_job_created: { label: "AI İş Başlatıldı", variant: "info", icon: ImagePlus },
  ai_job_completed: { label: "AI İş Tamamlandı", variant: "success", icon: CheckCircle2 },
  ai_job_failed: { label: "AI İş Başarısız", variant: "danger", icon: XCircle },
  credit: { label: "Kredi İşlemi", variant: "warning", icon: Coins },
  project: { label: "Proje İşlemi", variant: "neutral", icon: FileImage },
  subscription: { label: "Abonelik", variant: "info", icon: Clock },
  settings: { label: "Ayarlar", variant: "neutral", icon: Settings },
  workspace: { label: "Workspace", variant: "neutral", icon: FileImage },
};

const SETTING_LABELS: Record<string, string> = {
  style: "Stil",
  sceneEditMode: "Sahne modu",
  generationVariant: "Üretim varyantı",
  extraNotePreview: "Ek not",
  promptVersion: "Prompt versiyonu",
  referenceCount: "Referans sayısı",
  referenceImageCount: "Referans görsel sayısı",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function groupByDate(entries: readonly UserActivityEntry[]): Map<string, UserActivityEntry[]> {
  const groups = new Map<string, UserActivityEntry[]>();
  for (const entry of entries) {
    const dateKey = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("tr-TR") : "Bilinmeyen";
    const existingEntries = groups.get(dateKey);
    if (existingEntries) {
      existingEntries.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }
  return groups;
}

function getMetadataRecord(entry: UserActivityEntry): Record<string, unknown> {
  return entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata) ? entry.metadata : {};
}

function getSettingRows(entry: UserActivityEntry): Array<{ readonly label: string; readonly value: string }> {
  const metadata = getMetadataRecord(entry);
  const jobMetadata = metadata.jobMetadata && typeof metadata.jobMetadata === "object" && !Array.isArray(metadata.jobMetadata)
    ? metadata.jobMetadata as Record<string, unknown>
    : {};
  const source = { ...jobMetadata, ...metadata };

  return Object.entries(SETTING_LABELS)
    .map(([key, label]) => {
      const value = source[key];
      if (value === null || value === undefined || value === "") return null;
      return { label, value: String(value) };
    })
    .filter((row): row is { readonly label: string; readonly value: string } => row !== null);
}

function SideBySideView({ entry }: { entry: UserActivityEntry }) {
  const [showImages, setShowImages] = useState(false);
  const [inputFailed, setInputFailed] = useState(false);
  const [outputFailed, setOutputFailed] = useState(false);
  const inputImageUrl = entry.inputImageUrl || null;
  const panelId = `activity-images-${entry.id}`;

  if (!inputImageUrl && !entry.resultUrl) return null;

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={showImages}
        aria-controls={panelId}
        onClick={() => setShowImages(!showImages)}
        className="px-0 text-primary hover:text-primary/80"
      >
        <Images className="w-3 h-3" />
        {showImages ? "Görselleri Gizle" : "Görsel Karşılaştırması"}
      </Button>

      {showImages && (
        <div id={panelId} className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {inputImageUrl && (
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-gray-500">Yüklenen Görsel</span>
              <div className="relative aspect-video rounded-sm overflow-hidden border border-white/5 bg-black/40">
                {inputFailed ? (
                  <div className="flex items-center justify-center h-full text-[10px] text-gray-600">Görsel yüklenemedi</div>
                ) : (
                  <img
                    src={inputImageUrl}
                    alt="Yüklenen görsel"
                    className="w-full h-full object-contain"
                    onError={() => setInputFailed(true)}
                  />
                )}
              </div>
            </div>
          )}
          {entry.resultUrl && (
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-wider text-gray-500">AI Çıktısı</span>
              <div className="relative aspect-video rounded-sm overflow-hidden border border-white/5 bg-black/40">
                {outputFailed ? (
                  <div className="flex items-center justify-center h-full text-[10px] text-gray-600">Çıktı yüklenemedi (süresi dolmuş olabilir)</div>
                ) : (
                  <img
                    src={entry.resultUrl}
                    alt="AI çıktısı"
                    className="w-full h-full object-contain"
                    onError={() => setOutputFailed(true)}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityTimelineEntry({ entry }: { entry: UserActivityEntry }) {
  const config = TYPE_CONFIG[entry.type] || { label: entry.action, variant: "neutral" as const, icon: Clock };
  const Icon = config.icon;
  const settingRows = getSettingRows(entry);

  return (
    <div role="listitem" className="relative pl-8 pb-6 last:pb-0">
      <div className="absolute left-[11px] top-3 bottom-0 w-px bg-white/5 last:hidden" />
      <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-[#0d0f13] border border-white/10 flex items-center justify-center">
        <Icon className="w-3 h-3 text-gray-400" />
      </div>

      <div className="glass-card rounded-sm p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={config.variant}>{config.label}</Badge>
              {entry.toolId && (
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">
                  {entry.toolId}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-300 font-sans">{entry.summary}</p>
            {entry.resultText && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{entry.resultText}</p>}
            {entry.creditAmount !== undefined && (
              <p className="text-xs text-yellow-400/80 mt-1">
                <Coins className="w-3 h-3 inline mr-1" />
                {entry.creditAmount} kredi
                {entry.creditBalanceAfter !== undefined && (
                  <span className="text-gray-500"> (bakiye: {entry.creditBalanceAfter})</span>
                )}
              </p>
            )}
            {settingRows.length > 0 && (
              <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-sm border border-white/5 bg-black/20 p-3">
                {settingRows.map((row) => (
                  <div key={row.label}>
                    <dt className="text-[9px] uppercase tracking-wider text-gray-600">{row.label}</dt>
                    <dd className="text-xs text-gray-300 line-clamp-2">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <SideBySideView entry={entry} />
          </div>
          <span className="text-[10px] text-gray-600 whitespace-nowrap font-sans">{formatDate(entry.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function ActivityTimeline({ entries }: { entries: readonly UserActivityEntry[] }) {
  return (
    <div className="space-y-8" role="list">
      {Array.from(groupByDate(entries).entries()).map(([dateKey, dateEntries]) => (
        <div key={dateKey}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] uppercase tracking-wider text-gray-600 font-sans">{dateKey}</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <div>
            {dateEntries.map((entry) => (
              <ActivityTimelineEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
