"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { Logo } from "@/components/brand/logo";
import { buildAuthPageHref, getSafeRedirectPath } from "@/lib/auth/redirect";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-errors";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const searchParams = useSearchParams();
  const redirectTarget = getSafeRedirectPath(searchParams.get("from"), "/");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setLoading(true);
      await resetPassword(email);
      setSent(true);
      toast.success("Şifre sıfırlama e-postası gönderildi!");
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
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
          {sent ? (
            /* Gönderildi Durumu */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <div className="flex justify-center mb-6">
                <CheckCircle className="w-16 h-16 text-primary" />
              </div>
              <h1 className="font-serif text-3xl text-white italic mb-3">
                E-posta Gönderildi
              </h1>
              <p className="text-sm text-gray-400 font-sans mb-2">
                <span className="text-white font-medium">{email}</span>{" "}
                adresine şifre sıfırlama bağlantısı gönderildi.
              </p>
              <p className="text-xs text-gray-500 font-sans mb-8">
                E-postayı görmüyorsanız spam/junk klasörünüzü kontrol edin.
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
                className="text-sm font-sans text-primary hover:text-white transition-colors"
              >
                Farklı bir e-posta deneyin
              </button>
            </motion.div>
          ) : (
            /* Form Durumu */
            <>
              <h1 className="font-serif text-3xl text-white italic mb-2">
                Şifremi Unuttum
              </h1>
              <p className="text-sm text-gray-400 font-sans mb-8">
                Kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı
                gönderelim.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-black font-sans font-bold text-sm uppercase tracking-widest py-3 rounded-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  )}
                  {loading
                    ? "Gönderiliyor..."
                    : "Sıfırlama Bağlantısı Gönder"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Geri dön */}
        <div className="flex justify-center mt-6">
          <Link
            href={buildAuthPageHref("/giris", redirectTarget)}
            className="flex items-center gap-2 text-sm font-sans text-gray-500 hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
