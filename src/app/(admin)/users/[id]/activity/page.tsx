"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, ListFilter } from "lucide-react";
import { getUser, getUserActivity } from "@/lib/api/admin-client";
import type { UserActivityEntry, UserRecord } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ActivityTimeline } from "./activity-timeline";

const ACTIVITY_TYPE_OPTIONS = [
  { value: "all", label: "Tüm Aktiviteler" },
  { value: "ai_job_created", label: "AI İş Başlatma" },
  { value: "ai_job_completed", label: "AI İş Tamamlama" },
  { value: "ai_job_failed", label: "AI İş Hataları" },
  { value: "credit", label: "Kredi İşlemleri" },
  { value: "project", label: "Proje İşlemleri" },
  { value: "settings", label: "Ayarlar" },
  { value: "subscription", label: "Abonelik" },
] as const;

const PAGE_SIZE = 50;

type ActivityTypeFilter = typeof ACTIVITY_TYPE_OPTIONS[number]["value"];
type LoadMode = "replace" | "append";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UserActivityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [entries, setEntries] = useState<UserActivityEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>("all");

  const loadData = useCallback(async (mode: LoadMode = "replace", offset = 0) => {
    if (!id) return;
    const append = mode === "append";
    setLoading(!append);
    setLoadingMore(append);
    setError(null);

    try {
      const [userData, activityData] = await Promise.all([
        getUser(id),
        getUserActivity(id, {
          limit: PAGE_SIZE,
          offset: append ? offset : 0,
          type: typeFilter === "all" ? undefined : typeFilter,
        }),
      ]);
      setUser(userData);
      setEntries((currentEntries) => append ? [...currentEntries, ...(activityData.entries || [])] : activityData.entries || []);
      setHasMore(activityData.hasMore);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Veri yüklenirken hata oluştu."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [id, typeFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData("replace");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  if (loading) return <LoadingState message="Kullanıcı aktiviteleri yükleniyor..." />;

  if (error) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push(`/users/${id}`)} className="mb-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kullanıcıya Dön
        </Button>
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/users/${id}`)} className="mb-2">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kullanıcıya Dön
          </Button>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">
            {user?.displayName || "Kullanıcı"} — Aktivite Geçmişi
          </h1>
          {user && <p className="text-sm font-sans text-gray-400 mt-1">{user.email}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ListFilter className="w-3.5 h-3.5 text-gray-500" />
        {ACTIVITY_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTypeFilter(option.value)}
            aria-pressed={typeFilter === option.value}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-sm border transition-colors ${
              typeFilter === option.value
                ? "border-primary/50 text-primary bg-primary/5"
                : "border-white/5 text-gray-500 hover:text-gray-300 hover:border-white/10"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Clock} title="Aktivite bulunmuyor" description={typeFilter !== "all" ? "Bu filtreye uygun kayıt yok." : undefined} />
      ) : (
        <>
          <ActivityTimeline entries={entries} />
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" size="sm" loading={loadingMore} onClick={() => void loadData("append", entries.length)}>
                Daha Fazla Yükle
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
