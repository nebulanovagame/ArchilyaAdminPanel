"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { buildAuthPageHref, getSafeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseAuthErrorMessage } from "@/lib/supabase/auth-errors";

const PASSWORD_POLICY_ERROR =
  "Şifre en az 8 karakter, bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir.";

function validatePasswordPolicy(password: string): boolean {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialCharacter = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<\/?]/.test(password);

  return (
    hasMinimumLength &&
    hasUppercase &&
    hasLowercase &&
    hasDigit &&
    hasSpecialCharacter
  );
}

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    passwordConfirm?: string;
  }>({});
  const { signup, googleSignIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get("from"), "/");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Local validation
    const newErrors: { password?: string; passwordConfirm?: string } = {};
    if (!validatePasswordPolicy(password)) {
      newErrors.password = PASSWORD_POLICY_ERROR;
    }
    if (password !== passwordConfirm) {
      newErrors.passwordConfirm = "Şifreler eşleşmiyor.";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setLoading(true);
      await signup(name, email, password);
      toast.success("Hesabınız oluşturuldu!");
      router.replace(redirectTarget);
      router.refresh();
    } catch (error) {
      toast.error(getSupabaseAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true);
      await googleSignIn();
      toast.success("Google ile kayıt olundu!");
      router.replace(redirectTarget);
      router.refresh();
    } catch (error) {
      toast.error(getSupabaseAuthErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl text-primary tracking-[0.2em] uppercase">
            Archilya
          </h1>
          <p className="font-serif text-sm text-primary/60 tracking-[0.3em] uppercase mt-2">
            Luxury
          </p>
          <div className="mt-5 w-12 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent mx-auto" />
        </div>

        <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-8 md:p-10">
          <div className="mb-8">
            <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
              Yeni Hesap
            </p>
            <h2 className="text-2xl font-serif text-white italic">
              Hesap Oluştur
            </h2>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 rounded-sm border border-white/10 bg-white/5 px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-gray-300 transition-all duration-300 hover:border-primary/40 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
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
            )}
            Google ile Kayıt Ol
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0d0f13] px-3 text-[10px] font-sans uppercase tracking-widest text-gray-700">
                veya
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                Ad Soyad
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Adınız Soyadınız"
                  className="w-full rounded-sm border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                E-posta
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@email.com"
                  className="w-full rounded-sm border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  required
                  placeholder="En az 8 karakter"
                  className={`w-full rounded-sm border bg-white/5 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-gray-700 focus:outline-none transition-colors duration-300 ${
                    errors.password
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-primary/40"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400 font-sans">
                  {errors.password}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                Şifre Tekrar
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type={showPasswordConfirm ? "text" : "password"}
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    if (errors.passwordConfirm)
                      setErrors((p) => ({ ...p, passwordConfirm: undefined }));
                  }}
                  required
                  placeholder="Şifrenizi tekrar girin"
                  className={`w-full rounded-sm border bg-white/5 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-gray-700 focus:outline-none transition-colors duration-300 ${
                    errors.passwordConfirm
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-primary/40"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.passwordConfirm && (
                <p className="mt-1.5 text-xs text-red-400 font-sans">
                  {errors.passwordConfirm}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 mt-2"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              )}
              {loading ? "Hesap Oluşturuluyor..." : "Kayıt Ol"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] font-sans text-gray-600 mt-6">
          Zaten hesabınız var mı?{" "}
          <Link
            href={buildAuthPageHref("/giris", redirectTarget)}
            className="text-primary hover:text-white transition-colors"
          >
            Giriş Yapın
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
