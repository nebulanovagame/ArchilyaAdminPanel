"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import {
  CodexAdminApiError,
  createCodexSession,
  formatRemainingTime,
  getActiveCodexSession,
  getCodexConnectionStatus,
  getCodexSession,
  verifyCodexConnection,
  type CodexConnectionState,
  type CodexConnectionStatus,
  type CodexDeviceAuthSession,
  type CodexLaunchSession,
} from "@/lib/api/codex-client";

const ACTIVE_SESSION_STATUSES = new Set(["pending", "authorized"]);

const CONNECTION_META: Record<
  CodexConnectionState,
  { label: string; variant: BadgeVariant; description: string }
> = {
  healthy: {
    label: "Sağlıklı",
    variant: "success",
    description: "Sunucu kimliği hazır ve otomatik yenileme kullanılabilir.",
  },
  expiring: {
    label: "Yakında yenilenecek",
    variant: "warning",
    description: "Erişim süresi yaklaşıyor. Doğrulama, gerekirse otomatik yenilemeyi çalıştırır.",
  },
  renewal_required: {
    label: "Yenileme bekliyor",
    variant: "warning",
    description: "Erişim süresi dolmuş; kayıtlı yenileme kimliği doğrulama sırasında kullanılacak.",
  },
  incomplete: {
    label: "Eksik bağlantı",
    variant: "danger",
    description: "Bağlantı kaydı eksik. Yeni bir sunucu bağlantısı oluşturun.",
  },
  missing: {
    label: "Bağlı değil",
    variant: "danger",
    description: "Sunucuda kullanılabilir bir ChatGPT bağlantısı bulunamadı.",
  },
};

const SESSION_LABELS: Record<string, string> = {
  pending: "Tarayıcı girişi bekleniyor",
  authorized: "Kimlik alındı, doğrulanıyor",
  consumed: "Bağlantı tamamlandı",
  failed: "Bağlantı başarısız",
  incompatible: "Kimlik uyumsuz",
  expired: "Oturum süresi doldu",
  interrupted: "Önceki oturum sonlandırıldı",
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof CodexAdminApiError && error.traceId) {
    return `${error.message} İz: ${error.traceId}`;
  }
  return error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
}

export default function SettingsPage() {
  const [status, setStatus] = useState<CodexConnectionStatus | null>(null);
  const [session, setSession] = useState<CodexDeviceAuthSession | null>(null);
  const [launch, setLaunch] = useState<CodexLaunchSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [connection, activeSession] = await Promise.all([
        getCodexConnectionStatus(),
        getActiveCodexSession(),
      ]);
      setStatus(connection);
      setSession((current) => activeSession || (current && !ACTIVE_SESSION_STATUSES.has(current.status) ? current : null));
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadState(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadState]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || !ACTIVE_SESSION_STATUSES.has(session.status)) return;

    const poll = window.setInterval(async () => {
      try {
        const nextSession = await getCodexSession(session.id);
        setSession(nextSession);
        if (!ACTIVE_SESSION_STATUSES.has(nextSession.status)) {
          window.clearInterval(poll);
          if (nextSession.status === "consumed") {
            setLaunch(null);
            toast.success("Codex sunucu bağlantısı tamamlandı.");
            await loadState(true);
          } else {
            toast.error(SESSION_LABELS[nextSession.status] || "Bağlantı tamamlanamadı.");
          }
        }
      } catch (pollError) {
        window.clearInterval(poll);
        toast.error(getErrorMessage(pollError));
      }
    }, 3_000);

    return () => window.clearInterval(poll);
  }, [loadState, session]);

  const remainingSeconds = status?.expiresAt
    ? Math.floor((new Date(status.expiresAt).getTime() - now) / 1_000)
    : null;

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const verified = await verifyCodexConnection();
      setStatus(verified);
      setError(null);
      toast.success("Codex bağlantısı gerçek bir sağlayıcı isteğiyle doğrulandı.");
    } catch (verifyError) {
      const message = getErrorMessage(verifyError);
      setError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const created = await createCodexSession();
      setLaunch(created);
      setSession({
        id: created.sessionId,
        status: "pending",
        failureReason: null,
        issuedAt: new Date().toISOString(),
        expiresAt: created.sessionExpiresAt,
        consumedAt: null,
        updatedAt: new Date().toISOString(),
      });
      setError(null);
      toast.success("Tek kullanımlık sunucu bağlantısı oluşturuldu.");
    } catch (createError) {
      const message = getErrorMessage(createError);
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <LoadingState message="Codex bağlantısı denetleniyor..." />;

  const meta = CONNECTION_META[status?.state || "missing"];
  const sessionActive = Boolean(session && ACTIVE_SESSION_STATUSES.has(session.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-white italic">Ayarlar</h1>
          <p className="mt-1 text-sm text-gray-500">
            ChatGPT Plus ile çalışan backend Codex bağlantısının güvenli yönetimi
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadState()}
          loading={refreshing}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Durumu yenile
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Codex Sunucu Bağlantısı</CardTitle>
              <CardDescription>Canlı sağlayıcı ve OAuth yenileme durumu</CardDescription>
            </div>
            <Badge variant={meta.variant} className="w-fit text-[10px]">
              <Activity className="mr-1.5 h-3 w-3" />
              {meta.label}
            </Badge>
          </CardHeader>

          <p className="mb-5 text-sm leading-6 text-gray-400">{meta.description}</p>

          <dl className="grid gap-3 sm:grid-cols-2">
            <StatusItem icon={Bot} label="Üretim modeli" value={status?.model || "gpt-5.6-sol"} />
            <StatusItem
              icon={ShieldCheck}
              label="ChatGPT planı"
              value={status?.planType ? status.planType.toLocaleUpperCase("tr-TR") : "Bilinmiyor"}
            />
            <StatusItem
              icon={Clock3}
              label="Erişim süresi"
              value={formatRemainingTime(remainingSeconds)}
              detail={formatDate(status?.expiresAt)}
            />
            <StatusItem
              icon={RefreshCw}
              label="Otomatik yenileme"
              value={status?.autoRefreshAvailable ? "Hazır" : "Kullanılamıyor"}
            />
            <StatusItem
              icon={KeyRound}
              label="Hesap eşleşmesi"
              value={status?.accountBound ? "Tamam" : "Eksik"}
            />
            <StatusItem
              icon={Server}
              label="Kalıcı kayıt"
              value={status?.source === "persisted" ? "Sunucuda kayıtlı" : "Kayıtlı değil"}
              detail={status?.updatedAt ? `Güncelleme: ${formatDate(status.updatedAt)}` : undefined}
            />
          </dl>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-white/5 pt-5">
            <Button onClick={handleVerify} loading={verifying}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Bağlantıyı doğrula
            </Button>
            <Button variant="secondary" onClick={handleCreateSession} loading={creating}>
              <KeyRound className="h-3.5 w-3.5" />
              Yeni sunucu bağlantısı
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Güvenli Yenileme Kuralı</CardTitle>
            <CardDescription>Tek yetkili bağlantı noktası</CardDescription>
          </CardHeader>
          <div className="space-y-4 text-sm leading-6 text-gray-400">
            <p>
              Access token, refresh token veya <code className="text-primary">auth.json</code> bu
              ekrana girilmez ve yüklenmez. Yenileme yalnızca sunucunun cihaz giriş akışıyla yapılır.
            </p>
            <p>
              OpenCode ile sunucunun aynı refresh token&apos;ı paylaşması, token döndürüldüğünde
              diğer bağlantıyı bozabilir. Yeni bağlantıyı bu ekrandan tamamlayarak sunucuya ayrı
              bir oturum verin.
            </p>
            <div className="rounded-sm border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200/80">
              “Bağlantıyı doğrula” tokenı zorla döndürmez; yalnızca gerekiyorsa otomatik yeniler ve
              gerçek, düşük maliyetli bir sağlayıcı isteğiyle çalıştığını kanıtlar.
            </div>
          </div>
        </Card>
      </div>

      {(session || launch) && (
        <Card className={sessionActive ? "border-primary/25" : ""}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Yeniden Bağlanma Oturumu</CardTitle>
              <CardDescription>Tek kullanımlık ve süreli tarayıcı akışı</CardDescription>
            </div>
            {session && (
              <Badge
                variant={session.status === "consumed" ? "success" : sessionActive ? "info" : "warning"}
                className="w-fit"
              >
                {SESSION_LABELS[session.status] || session.status}
              </Badge>
            )}
          </CardHeader>

          <div className="grid gap-4 text-sm text-gray-400 sm:grid-cols-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Oturum bitişi</p>
              <p className="mt-1 text-gray-200">{formatDate(session?.expiresAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Son durum</p>
              <p className="mt-1 text-gray-200">{formatDate(session?.updatedAt)}</p>
            </div>
          </div>

          {session?.failureReason && (
            <p className="mt-4 rounded-sm border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
              Hata kodu: {session.failureReason}
            </p>
          )}

          {launch && sessionActive && (
            <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs leading-5 text-gray-500">
                Bu bağlantı {formatDate(launch.launchExpiresAt)} tarihinde geçersiz olur.
                Bağlantıyı paylaşmayın.
              </div>
              <a
                href={launch.launchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-sm border border-primary/20 bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-white"
              >
                Tarayıcı girişini aç
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {!launch && sessionActive && (
            <p className="mt-5 border-t border-white/5 pt-4 text-xs leading-5 text-gray-500">
              Güvenlik nedeniyle tek kullanımlık bağlantı yeniden gösterilemez. Önceki sekme
              kapandıysa “Yeni sunucu bağlantısı” ile bu oturumu sonlandırıp yenisini oluşturun.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function StatusItem({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex gap-3 rounded-sm border border-white/5 bg-black/10 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <dt className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{label}</dt>
        <dd className="mt-1 text-sm font-medium text-gray-200">{value}</dd>
        {detail && <p className="mt-1 truncate text-[10px] text-gray-600">{detail}</p>}
      </div>
    </div>
  );
}
