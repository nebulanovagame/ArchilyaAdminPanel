"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle, RotateCcw, KeyRound, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { buildAuthPageHref, getSafeRedirectPath } from "@/lib/auth/redirect";
import { getSupabaseAuthErrorMessage } from "@/lib/supabase/auth-errors";

type Mode = "request" | "update" | "success";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, completePasswordReset, isRecoveryMode } = useAuth();
  const redirectTarget = getSafeRedirectPath(searchParams.get("from"), "/");

  // Form state
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Update password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updateError, setUpdateError] = useState("");

  // Determine which mode to show — derived from recovery state
  const mode: Mode = isRecoveryMode ? "update" : "request";

  // URL error handling for expired/invalid links
  useEffect(() => {
    const error = searchParams.get("error");
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");

    if (error || errorCode) {
      const message =
        errorDescription ||
        (errorCode === "otp_expired"
          ? "Şifre sıfırlama bağlantısının süresi dolmuş. Lütfen yeniden bağlantı isteyin."
          : "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeniden bağlantı isteyin.");
      toast.error(message);
    }
  }, [searchParams]);

  async function handleSendResetLink(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      await resetPassword(email);
      setSent(true);
      toast.success("Şifre sıfırlama e-postası gönderildi!");
    } catch (error) {
      toast.error(getSupabaseAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setUpdateError("");

    // Client-side validation
    if (!newPassword || !confirmPassword) {
      setUpdateError("Lütfen şifre alanlarını doldurun.");
      return;
    }

    if (newPassword.length < 8) {
      setUpdateError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setUpdateError("Şifreler eşleşmiyor.");
      return;
    }

    try {
      setLoading(true);
      await completePasswordReset(newPassword);

      // Show success message then redirect to login
      toast.success("Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.");

      // Wait briefly for toast, then redirect to login
      setTimeout(() => {
        router.push("/giris");
      }, 1500);
    } catch (error) {
      setUpdateError(getSupabaseAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4">
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
          {mode === "request" && sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-14 h-14 text-primary" />
              </div>
              <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
                Başarılı
              </p>
              <h2 className="text-2xl font-serif text-white italic mb-3">
                E-posta Gönderildi
              </h2>
              <p className="text-sm text-gray-500 font-sans mb-2">
                <span className="text-white">{email}</span>{" "}
                adresine şifre sıfırlama bağlantısı gönderildi.
              </p>
              <p className="text-xs text-gray-600 font-sans mb-8">
                E-postayı görmüyorsanız spam/junk klasörünüzü kontrol edin.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="inline-flex items-center gap-2 text-xs font-sans uppercase tracking-widest text-primary hover:text-white transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Farklı bir e-posta deneyin
              </button>
            </motion.div>
          ) : mode === "request" ? (
            <>
              <div className="mb-8">
                <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
                  Şifre Sıfırlama
                </p>
                <h2 className="text-2xl font-serif text-white italic">
                  Şifremi Unuttum
                </h2>
                <p className="text-sm text-gray-500 font-sans mt-2">
                  Kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı
                  gönderelim.
                </p>
              </div>

              <form onSubmit={handleSendResetLink} className="space-y-5">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && (
                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  )}
                  {loading
                    ? "Gönderiliyor..."
                    : "Sıfırlama Bağlantısı Gönder"}
                </button>
              </form>
            </>
          ) : (
            /* mode === "update" */
            <>
              <div className="mb-8">
                <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
                  Şifre Sıfırlama
                </p>
                <h2 className="text-2xl font-serif text-white italic">
                  Yeni Şifre Belirleyin
                </h2>
                <p className="text-sm text-gray-500 font-sans mt-2">
                  Yeni şifrenizi belirleyin ve onaylayın.
                </p>
              </div>

              {updateError && (
                <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {updateError}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Yeni Şifre
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="En az 8 karakter"
                      className="w-full rounded-sm border border-white/10 bg-white/5 pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-2">
                    Yeni Şifre Tekrar
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Şifreyi tekrar girin"
                      className="w-full rounded-sm border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none transition-colors duration-300"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-sm bg-primary px-4 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && (
                    <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  )}
                  {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex justify-center mt-6">
          <Link
            href={buildAuthPageHref("/giris", redirectTarget)}
            className="flex items-center gap-2 text-[11px] font-sans text-gray-600 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Giriş sayfasına dön
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
