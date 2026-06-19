"use client";

import { useState } from "react";
import { Send, Megaphone, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { sendNotification } from "@/lib/api/admin-client";

export default function NotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("broadcast");
  const [targetMode, setTargetMode] = useState<"all" | "specific">("all");
  const [targetUserIds, setTargetUserIds] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const payload: {
        title: string;
        body: string;
        type?: string;
        targetUserIds?: string[];
        confirmBroadcast?: boolean;
      } = { title: title.trim(), body: body.trim(), type };

      if (targetMode === "specific") {
        const ids = targetUserIds
          .split("\n")
          .map((id) => id.trim())
          .filter(Boolean);
        if (ids.length === 0) {
          setResult({ status: "error", message: "En az bir kullanici ID'si girin." });
          setSending(false);
          return;
        }
        payload.targetUserIds = ids;
      } else {
        payload.confirmBroadcast = true;
      }

      const res = await sendNotification(payload);
      setResult({
        status: "success",
        message: `Bildirim basariyla gonderildi! ${res.sentCount} kullaniciya ulasildi.`,
      });
      setTitle("");
      setBody("");
      setTargetUserIds("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Bildirim gonderilirken hata olustu.";
      setResult({ status: "error", message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-white italic">Bildirim Gonder</h1>
      </div>

      <div className="rounded-sm border border-white/5 bg-[#0d0f13] p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Bildirim Tipi */}
          <div>
            <label className="block text-xs font-sans font-medium uppercase tracking-widest text-gray-400 mb-2">
              Bildirim Tipi
            </label>
            <div className="flex gap-3">
              {[
                { value: "broadcast", label: "Duyuru" },
                { value: "announcement", label: "Duyuru (Yeni)" },
                { value: "system", label: "Sistem" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`px-4 py-2 rounded-sm text-xs font-sans uppercase tracking-widest border transition-all ${
                    type === opt.value
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "text-gray-500 border-white/5 hover:text-gray-300 hover:bg-white/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Başlık */}
          <div>
            <label
              htmlFor="title"
              className="block text-xs font-sans font-medium uppercase tracking-widest text-gray-400 mb-2"
            >
              Baslik
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bildirim basligi"
              maxLength={240}
              required
              className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* İçerik */}
          <div>
            <label
              htmlFor="body"
              className="block text-xs font-sans font-medium uppercase tracking-widest text-gray-400 mb-2"
            >
              Icerik
            </label>
            <textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Bildirim mesaji"
              maxLength={2000}
              rows={4}
              required
              className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>

          {/* Hedef */}
          <div>
            <label className="block text-xs font-sans font-medium uppercase tracking-widest text-gray-400 mb-2">
              Hedef Kitle
            </label>
            <div className="flex gap-3 mb-3">
              <button
                type="button"
                onClick={() => setTargetMode("all")}
                className={`px-4 py-2 rounded-sm text-xs font-sans uppercase tracking-widest border transition-all ${
                  targetMode === "all"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-gray-500 border-white/5 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                Tum Kullanicilar
              </button>
              <button
                type="button"
                onClick={() => setTargetMode("specific")}
                className={`px-4 py-2 rounded-sm text-xs font-sans uppercase tracking-widest border transition-all ${
                  targetMode === "specific"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-gray-500 border-white/5 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                Belirli Kullanicilar
              </button>
            </div>
            {targetMode === "specific" && (
              <textarea
                value={targetUserIds}
                onChange={(e) => setTargetUserIds(e.target.value)}
                placeholder="Kullanici ID'leri (her satira bir ID)"
                rows={3}
                className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={sending || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-black text-xs font-sans font-bold uppercase tracking-widest rounded-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Gonderiliyor..." : "Bildirimi Gonder"}
            </button>

            {sending && (
              <span className="text-xs text-gray-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Kullanicilara dagitiliyor...
              </span>
            )}
          </div>
        </form>

        {/* Result */}
        {result && (
          <div
            className={`mt-6 flex items-start gap-3 rounded-sm px-4 py-3 text-sm ${
              result.status === "success"
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-red-500/10 border border-red-500/20 text-red-300"
            }`}
          >
            {result.status === "success" ? (
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-sm border border-white/5 bg-[#0d0f13] p-4 max-w-2xl">
        <div className="flex items-start gap-3">
          <Megaphone className="w-4 h-4 text-primary mt-0.5" />
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              <strong className="text-gray-400">Tum kullanicilar:</strong> Sisteme kayitli herkese bildirim gonderir.
            </p>
            <p>
              <strong className="text-gray-400">Belirli kullanicilar:</strong> Sadece girdiginiz ID&apos;lere gonderir.
            </p>
            <p>
              <strong className="text-gray-400">Not:</strong> Bildirimler kullanicilarin bildirim panellerinde gorunecektir.
              Push notification (bildirim sesi/ikonu) icin ayri bir entegrasyon gereklidir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
