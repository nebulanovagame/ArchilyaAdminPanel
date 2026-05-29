"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

import { useAdminAuth } from "./admin-auth-provider";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-primary tracking-[0.2em] uppercase">
              Archilya
            </h1>
            <p className="font-serif text-sm text-primary/60 tracking-[0.3em] uppercase mt-2">
              Admin Panel
            </p>
            <div className="mt-5 w-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto" />
          </div>

          <div className="mb-8">
            <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
              Giriş
            </p>
            <h2 className="text-2xl font-serif text-white italic">
              Yönetici Girişi
            </h2>
          </div>

          {error && (
            <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500"
              >
                E-posta
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500"
              >
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
