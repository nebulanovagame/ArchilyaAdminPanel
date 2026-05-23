import React, { useState, useRef, useEffect } from 'react';
import type { UserData } from '../../shared/types';

interface LoginProps {
  onLoginSuccess: (user: UserData) => void;
}

type AuthMode = 'login' | 'register' | 'forgot-password';

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const response = await window.api.login(email, password, rememberMe);
        if (response.success && response.user) {
          onLoginSuccess(response.user);
        } else {
          setError(response.error || 'Giriş yapılamadı.');
        }
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Şifreler uyuşmuyor.');
          setLoading(false);
          return;
        }
        const response = await window.api.register(email, password);
        if (response.success) {
          setSuccessMessage(response.message || 'Kayıt başarılı! Doğrulama mailinizi kontrol edin.');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setMode('login'), 3000);
        } else {
          setError(response.error || 'Kayıt yapılamadı.');
        }
      } else if (mode === 'forgot-password') {
        const response = await window.api.resetPassword(email);
        if (response.success) {
          setSuccessMessage(response.message || 'Sıfırlama maili gönderildi.');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setMode('login'), 3000);
        } else {
          setError(response.error || 'İşlem başarısız.');
        }
      }
    } catch (err) {
      console.error('[Login] Hata:', err);
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.api.loginGuest();
      if (response.success && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.error || 'Misafir girişi başarısız.');
      }
    } catch (err) {
      console.error('[Login] Misafir girişi hatası:', err);
      setError(err instanceof Error ? err.message : 'Bir bağlantı hatası oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await window.api.loginWithGoogle(rememberMe);
      if (response.success && response.user) {
        onLoginSuccess(response.user);
      } else {
        setError(response.error || 'Google ile giriş başarısız.');
      }
    } catch (err) {
      console.error('[Login] Google girişi hatası:', err);
      setError(err instanceof Error ? err.message : 'Google ile giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full z-50">
      <div className="w-[450px] p-1 bg-gradient-to-br from-archilya-gold/20 via-archilya-panel to-archilya-gold/5 rounded-xl backdrop-blur-sm">
        <div className="bg-archilya-panel/95 border border-archilya-gold/10 p-8 rounded-lg shadow-2xl relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-archilya-gold to-transparent opacity-50"></div>
          
          <div className="flex justify-center gap-8 mb-8">
            <button 
              onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
              className={`font-display text-sm tracking-widest uppercase transition-all ${mode === 'login' ? 'text-archilya-gold border-b-2 border-archilya-gold' : 'text-archilya-text-dim hover:text-archilya-text'}`}
            >
              GİRİŞ
            </button>
            <button 
              onClick={() => { setMode('register'); setError(null); setSuccessMessage(null); }}
              className={`font-display text-sm tracking-widest uppercase transition-all ${mode === 'register' ? 'text-archilya-gold border-b-2 border-archilya-gold' : 'text-archilya-text-dim hover:text-archilya-text'}`}
            >
              KAYIT
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="group">
              <label className="text-[10px] text-archilya-gold/70 uppercase tracking-wider mb-1 block">E-Posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-archilya-dark border border-archilya-gold/20 rounded px-4 py-2.5 text-archilya-text text-sm focus:outline-none focus:border-archilya-gold transition-all duration-300 placeholder-white/5"
                placeholder="ornek@archilya.com"
              />
            </div>

            {mode !== 'forgot-password' && (
              <div className="group">
                <label className="text-[10px] text-archilya-gold/70 uppercase tracking-wider mb-1 block">Şifre</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-archilya-dark border border-archilya-gold/20 rounded px-4 py-2.5 text-archilya-text text-sm focus:outline-none focus:border-archilya-gold transition-all duration-300 placeholder-white/5"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="group">
                <label className="text-[10px] text-archilya-gold/70 uppercase tracking-wider mb-1 block">Şifre Onay</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-archilya-dark border border-archilya-gold/20 rounded px-4 py-2.5 text-archilya-text text-sm focus:outline-none focus:border-archilya-gold transition-all duration-300 placeholder-white/5"
                  placeholder="••••••••"
                />
              </div>
            )}

            {mode === 'login' && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                  <div className={`w-3.5 h-3.5 border border-archilya-gold/40 rounded flex items-center justify-center transition-all ${rememberMe ? 'bg-archilya-gold' : 'bg-transparent'}`}>
                    {rememberMe && <div className="w-1.5 h-1.5 bg-black rounded-sm"></div>}
                  </div>
                  <span className="text-[10px] text-archilya-text-dim select-none">Beni Hatırla</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-[10px] text-archilya-gold/60 hover:text-archilya-gold transition-colors"
                >
                  Şifremi Unuttum
                </button>
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 text-red-200 text-[10px] p-2 rounded text-center">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-900/20 border border-green-500/30 text-green-200 text-[10px] p-2 rounded text-center">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`mt-2 w-full bg-archilya-gold text-black font-display font-bold py-3 rounded hover:bg-[#F4CF57] transition-all transform active:scale-95 disabled:opacity-50 text-xs tracking-widest uppercase`}
            >
              {loading ? 'Lütfen Bekleyin...' : mode === 'login' ? 'Sisteme Giriş' : mode === 'register' ? 'Kayıt Ol' : 'Sıfırlama Bağlantısı Gönder'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-archilya-panel px-4 text-archilya-text-dim tracking-tighter">Veya</span></div>
            </div>

            {mode === 'login' && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full border border-archilya-gold/30 hover:border-archilya-gold text-archilya-text hover:text-archilya-gold font-display py-2.5 rounded transition-all text-[10px] tracking-[0.2em] uppercase"
              >
                Google ile Giriş Yap
              </button>
            )}

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full border border-white/10 hover:border-archilya-gold/40 text-archilya-text hover:text-archilya-gold font-display py-2.5 rounded transition-all text-[10px] tracking-[0.2em] uppercase"
            >
              Misafir Olarak Dene
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
