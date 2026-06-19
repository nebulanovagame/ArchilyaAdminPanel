"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Coins, MinusCircle, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { getUser, grantCredits, deductCredits } from "@/lib/api/admin-client";
import type { UserRecord } from "@/lib/api/types";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGrant, setShowGrant] = useState(false);
  const [showDeduct, setShowDeduct] = useState(false);
  const [creditAmount, setCreditAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadUser = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const nextUser = await getUser(id);
      setUser(nextUser);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Kullanici yuklenirken hata olustu."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    if (!id) return;

    getUser(id)
      .then((nextUser) => {
        if (!cancelled) {
          setUser(nextUser);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(getErrorMessage(loadError, "Kullanici yuklenirken hata olustu."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleGrant = async () => {
    const amount = parseInt(creditAmount, 10);
    if (!amount || amount <= 0) { toast.error("Gecerli bir miktar girin."); return; }
    setSubmitting(true);
    try {
      await grantCredits(id, amount, "Admin panelinden kredi yuklemesi");
      toast.success(`${amount} kredi yuklendi!`);
      setShowGrant(false); setCreditAmount(""); void loadUser();
    } catch (grantError: unknown) { toast.error(getErrorMessage(grantError, "Hata.")); }
    finally { setSubmitting(false); }
  };

  const handleDeduct = async () => {
    const amount = parseInt(creditAmount, 10);
    if (!amount || amount <= 0) { toast.error("Gecerli bir miktar girin."); return; }
    if (amount > (user?.credits || 0)) {
      toast.error("Kullanici bu kadar krediye sahip degil.");
      return;
    }
    setSubmitting(true);
    try {
      await deductCredits(id, amount, "Admin panelinden kredi dusumu");
      toast.success(`${amount} kredi silindi!`);
      setShowDeduct(false); setCreditAmount(""); void loadUser();
    } catch (deductError: unknown) { toast.error(getErrorMessage(deductError, "Hata.")); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingState message="Kullanici yukleniyor..." />;

  if (error) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/users")} className="mb-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kullanicilara Don
        </Button>
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/users")}>
        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Kullanicilara Don
      </Button>

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xl">
            {(user.displayName?.[0] || user.email?.[0] || "?").toLocaleUpperCase("tr-TR")}
          </div>
          <div>
            <CardTitle>{user.displayName || "Isimsiz Kullanici"}</CardTitle>
            <p className="text-sm font-sans text-gray-400">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm font-sans mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">Rol</span>
            <Badge variant={user.role === "admin" ? "warning" : "default"}>
              {user.role === "admin" ? "Admin" : "Kullanici"}
            </Badge>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">Durum</span>
            <span className="text-white">{user.status === "active" ? "Aktif" : "Pasif"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">Workspace</span>
            <span className="text-white">{user.workspaceCount}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">
              <Coins className="w-3 h-3 inline mr-1 text-yellow-400" />
              Kredi Bakiyesi
            </span>
            <span className="text-white font-bold text-lg">{user.credits?.toLocaleString("tr-TR") || "0"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">
              <TrendingUp className="w-3 h-3 inline mr-1 text-blue-400" />
              Toplam Harcama
            </span>
            <span className="text-white">{user.totalCreditsUsed?.toLocaleString("tr-TR") || "0"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">Kayit</span>
            <span className="text-white">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("tr-TR") : "-"}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-gray-500 block mb-1">Son Giris</span>
            <span className="text-white">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString("tr-TR") : "-"}</span>
          </div>
        </div>

        <div className="border-t border-white/5 pt-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={() => { setShowDeduct(false); setShowGrant(true); setCreditAmount(""); }}>
            <Coins className="w-3.5 h-3.5 mr-1" /> Kredi Yukle
          </Button>
          <Button variant="danger" size="sm" onClick={() => { setShowGrant(false); setShowDeduct(true); setCreditAmount(""); }}>
            <MinusCircle className="w-3.5 h-3.5 mr-1" /> Kredi Sil
          </Button>
        </div>
      </Card>

      {/* Grant Modal */}
      {showGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0d0f13] border border-white/10 rounded-sm p-6 w-full max-w-sm mx-4">
            <h3 className="font-serif text-lg text-white italic mb-4">Kredi Yukle</h3>
            <p className="text-xs font-sans text-gray-400 mb-4">{user.email} - Mevcut bakiye: <span className="text-yellow-400 font-bold">{user.credits?.toLocaleString("tr-TR") || "0"}</span></p>
            <Input type="number" min="1" placeholder="Miktar" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowGrant(false)} disabled={submitting}>Iptal</Button>
              <Button variant="primary" size="sm" onClick={handleGrant} loading={submitting}>Yukle</Button>
            </div>
          </div>
        </div>
      )}

      {/* Deduct Modal */}
      {showDeduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0d0f13] border border-white/10 rounded-sm p-6 w-full max-w-sm mx-4">
            <h3 className="font-serif text-lg text-white italic mb-4">Kredi Sil</h3>
            <p className="text-xs font-sans text-gray-400 mb-4">{user.email} - Mevcut bakiye: <span className="text-yellow-400 font-bold">{user.credits?.toLocaleString("tr-TR") || "0"}</span></p>
            <Input type="number" min="1" placeholder="Silinecek miktar" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} autoFocus />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" onClick={() => setShowDeduct(false)} disabled={submitting}>Iptal</Button>
              <Button variant="danger" size="sm" onClick={handleDeduct} loading={submitting}>Sil</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
