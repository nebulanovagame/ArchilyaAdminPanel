"use client";

import { useEffect, useState } from "react";
import { UserRound, UserPlus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listBetaTesters, updateBetaTester } from "@/lib/api/admin-client";
import type { BetaTesterRecord } from "@/lib/api/types";

export default function BetaTestersPage() {
  const [testers, setTesters] = useState<BetaTesterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [removing, setRemoving] = useState<string | null>(null);

  const loadTesters = () => {
    setLoading(true);
    setError(null);
    listBetaTesters({ limit: 200 })
      .then((data) => {
        setTesters(data.testers);
        setTotal(data.total);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Veri yuklenemedi";
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    listBetaTesters({ limit: 200 })
      .then((data) => {
        setTesters(data.testers);
        setTotal(data.total);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Veri yuklenemedi";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setFormError("E-posta adresi gerekli");
      return;
    }

    setAdding(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await updateBetaTester(trimmed, "add");
      setFormSuccess(res.message || "Beta testcisi eklendi");
      setEmail("");
      loadTesters();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Islem basarisiz";
      setFormError(message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (testerEmail: string) => {
    if (!window.confirm(`${testerEmail} beta testcilikten cikarilsin mi?`)) return;

    setRemoving(testerEmail);
    try {
      await updateBetaTester(testerEmail, "remove");
      loadTesters();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Cikarma islemi basarisiz";
      alert(message);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return <LoadingState message="Beta testciler yukleniyor..." />;
  if (error) return (
    <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
      {error}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Beta Testciler</h1>
      </div>

      {/* Add Form */}
      <div className="glass-card rounded-sm overflow-hidden p-5">
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="beta-email"
              className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5"
            >
              E-posta Adresi
            </label>
            <input
              id="beta-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFormError(null);
                setFormSuccess(null);
              }}
              placeholder="ornek@mail.com"
              className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <UserPlus className="w-3.5 h-3.5" />
            )}
            {adding ? "Ekleniyor..." : "Ekle"}
          </Button>
        </form>

        {formError && (
          <div className="mt-3 rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {formError}
          </div>
        )}

        {formSuccess && (
          <div className="mt-3 rounded-sm border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-emerald-300">
            {formSuccess}
          </div>
        )}
      </div>

      {/* Table */}
      {testers.length === 0 ? (
        <EmptyState icon={UserRound} title="Beta testci bulunamadi" description="Yukaridaki formu kullanarak kullanici ekleyin" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-[10px] font-sans uppercase tracking-widest text-gray-500">
              Toplam {total} testci
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-posta</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kayit Tarihi</TableHead>
                <TableHead>Islem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testers.map((tester) => (
                <TableRow key={tester.id}>
                  <TableCell className="text-sm">{tester.email}</TableCell>
                  <TableCell>{tester.display_name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="info">Beta</Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {tester.created_at
                      ? new Date(tester.created_at).toLocaleDateString("tr-TR")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={removing === tester.email}
                      onClick={() => handleRemove(tester.email)}
                    >
                      {removing === tester.email ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      Cikar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
