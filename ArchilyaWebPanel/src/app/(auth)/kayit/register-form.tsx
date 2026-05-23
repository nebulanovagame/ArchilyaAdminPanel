"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/brand/logo";
import { buildAuthPageHref, getSafeRedirectPath } from "@/lib/auth/redirect";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-errors";

const PASSWORD_POLICY_ERROR =
  "Şifre en az 8 karakter, bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir.";

function validatePasswordPolicy(password: string): boolean {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialCharacter = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]/.test(password);

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
      toast.error(getFirebaseAuthErrorMessage(error));
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
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <Logo variant="auth" />
        </div>

        {/* Card */}
        <div className="glass-card rounded-sm p-8 md:p-10">
          <h1 className="font-serif text-3xl text-white italic mb-2">
            Hesap Oluştur
          </h1>
          <p className="text-sm text-gray-400 font-sans mb-8">
            Ücretsiz hesabınızı oluşturun ve başlayın.
          </p>

          {/* Google ile kayıt */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-white/10 bg-white/5 hover:bg-white/10 transition-colors rounded-sm py-3 mb-6 text-sm font-sans font-medium text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Google ile Kayıt Ol
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-gray-500 font-sans uppercase tracking-widest">
              veya
            </span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Ad Soyad */}
            <div>
              <label className="block text-xs font-sans font-medium text-gray-400 uppercase tracking-widest mb-2">
                Ad Soyad
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Adınız Soyadınız"
                  className="w-full bg-white/5 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white font-sans placeholder:text-gray-600 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            {/* E-posta */}
            <div>
              <label className="block text-xs font-sans font-medium text-gray-400 uppercase tracking-widest mb-2">
                E-posta
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ornek@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-sm pl-11 pr-4 py-3 text-sm text-white font-sans placeholder:text-gray-600 focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-xs font-sans font-medium text-gray-400 uppercase tracking-widest mb-2">
                Şifre
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  required
                  placeholder="En az 6 karakter"
                  className={`w-full bg-white/5 border rounded-sm pl-11 pr-12 py-3 text-sm text-white font-sans placeholder:text-gray-600 focus:outline-none transition-colors ${
                    errors.password
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-primary/60"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-400 font-sans">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Şifre Tekrar */}
            <div>
              <label className="block text-xs font-sans font-medium text-gray-400 uppercase tracking-widest mb-2">
                Şifre Tekrar
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
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
                  className={`w-full bg-white/5 border rounded-sm pl-11 pr-12 py-3 text-sm text-white font-sans placeholder:text-gray-600 focus:outline-none transition-colors ${
                    errors.passwordConfirm
                      ? "border-red-500/50 focus:border-red-500"
                      : "border-white/10 focus:border-primary/60"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.passwordConfirm && (
                <p className="mt-1 text-xs text-red-400 font-sans">
                  {errors.passwordConfirm}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-black font-sans font-bold text-sm uppercase tracking-widest py-3 rounded-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              )}
              {loading ? "Hesap Oluşturuluyor..." : "Kayıt Ol"}
            </button>
          </form>
        </div>

        {/* Giriş yap linki */}
        <p className="text-center text-sm font-sans text-gray-500 mt-6">
          Zaten hesabınız var mı?{" "}
          <Link
            href={buildAuthPageHref("/giris", redirectTarget)}
            className="text-primary hover:text-white transition-colors font-medium"
          >
            Giriş Yapın
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
