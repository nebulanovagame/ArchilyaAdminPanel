"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseAuthErrorMessage } from "@/lib/supabase/auth-errors";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, googleSignIn } = useAuth();
  const redirectTarget = getSafeRedirectPath(
    searchParams.get("from") ?? searchParams.get("redirect"),
    "/",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      router.replace(redirectTarget);
      router.refresh();
    } catch (err) {
      setError(getSupabaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await googleSignIn();
    } catch (err) {
      setError(getSupabaseAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-8 md:p-10">
          <div className="text-center mb-10">
            <h1 className="font-serif text-3xl text-primary tracking-[0.2em] uppercase">
              Archilya
            </h1>
            <p className="font-serif text-sm text-primary/60 tracking-[0.3em] uppercase mt-2">
              Luxury
            </p>
            <div className="mt-5 w-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto" />
          </div>

          <div className="mb-8">
            <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
              Giriş
            </p>
            <h2 className="text-2xl font-serif text-white italic">
              Hesabınıza Giriş Yapın
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

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-3.5 w-3.5 rounded-sm border-white/10 bg-white/5 accent-primary"
                />
                <label
                  htmlFor="remember"
                  className="text-[11px] font-sans text-gray-500"
                >
                  Beni hatırla
                </label>
              </div>
              <Link
                href="/sifre-sifirla"
                className="text-[11px] font-sans text-gray-500 hover:text-primary transition-colors"
              >
                Şifremi unuttum
              </Link>
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

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#0d0f13] px-3 text-[10px] font-sans uppercase tracking-widest text-gray-700">
                  veya
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-gray-300 transition-all duration-300 hover:border-primary/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google ile Giriş
            </button>
          </div>

          <p className="text-center text-[11px] font-sans text-gray-600 mt-6">
            Hesabınız yok mu?{" "}
            <Link
              href="/kayit"
              className="text-primary hover:text-white transition-colors"
            >
              Kayıt Ol
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
