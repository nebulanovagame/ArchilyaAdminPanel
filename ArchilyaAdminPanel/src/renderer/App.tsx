import { useEffect, useRef, useState } from 'react';
import AdminPanel from './components/AdminPanel';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const hasAttemptedAutoLoginRef = useRef(false);

  // TODO: ENTER YOUR ADMIN CREDENTIALS HERE
  const ADMIN_EMAIL = "admin@archilya.com"; 
  const ADMIN_PASSWORD = "sifre123";

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) {
        return;
      }

      if (currentUser) {
        setUser(currentUser);
        setAuthError(null);
        setLoading(false);
        return;
      }

      setUser(null);

      if (hasAttemptedAutoLoginRef.current) {
        setLoading(false);
        return;
      }

      hasAttemptedAutoLoginRef.current = true;
      setLoading(true);

      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        console.error('Auto-login failed:', error);
        setAuthError(`Giris basarisiz: ${(error as { message?: string })?.message || 'Bilinmeyen hata'}`);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-900 text-white">Sistem başlatılıyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
       <header className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-950">
          <h1 className="text-xl font-bold text-emerald-500">Archilya Admin</h1>
          <div className="text-sm text-gray-400">
            {user ? (
              <span className="text-emerald-400">● {user.email}</span>
            ) : (
              <span className="text-red-400">● Giriş Yapılmadı</span>
            )}
          </div>
       </header>
       
       <main className="p-6">
         {!user ? (
            <div className="max-w-4xl mx-auto bg-red-900/20 border border-red-500/50 p-4 rounded-lg text-red-200 mb-6 text-center">
              <p className="font-bold">Oturum Acilamadi</p>
              <p>{authError || 'Kullanici bilgisi alinamadi. Lutfen Firebase kimlik bilgilerini kontrol edin.'}</p>
            </div>
          ) : (
            <AdminPanel user={user} />
          )}
       </main>
    </div>
  );
}

export default App;
