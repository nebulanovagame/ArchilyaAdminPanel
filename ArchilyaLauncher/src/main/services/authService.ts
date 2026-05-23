import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously,
  sendPasswordResetEmail,
  sendEmailVerification,
  fetchSignInMethodsForEmail,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Store from 'electron-store';
import { safeStorage, shell } from 'electron';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import log from 'electron-log';

// Session persistence için electron-store
const store = new Store<{ savedEmail?: string; rememberMe?: boolean; encryptedPassword?: string }>();
const GOOGLE_OAUTH_TIMEOUT_MS = 120_000;
const PASSWORD_RESET_TIMEOUT_MS = 20_000;
const GOOGLE_OAUTH_DEFAULT_PORT = 47193;
const GOOGLE_OAUTH_DEFAULT_PATH = '/google-auth/callback';

// Firebase hata kodlarını Türkçe'ye çevir
function getErrorMessage(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found':        'Bu e-posta adresiyle kayıtlı hesap bulunamadı.',
    'auth/wrong-password':        'Şifre hatalı.',
    'auth/invalid-email':         'Geçersiz e-posta adresi.',
    'auth/user-disabled':         'Bu hesap devre dışı bırakılmış.',
    'auth/email-already-in-use':  'Bu e-posta adresi zaten kullanımda.',
    'auth/weak-password':         'Şifre en az 6 karakter olmalıdır.',
    'auth/too-many-requests':     'Çok fazla başarısız deneme. Lütfen bekleyin.',
    'auth/network-request-failed':'İnternet bağlantısı yok.',
    'auth/invalid-credential':    'E-posta veya şifre hatalı.',
    'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase üzerinde etkin değil.',
    'auth/missing-email':         'Lütfen bir e-posta adresi girin.',
  };
  return map[code] || 'Beklenmedik bir hata oluştu.';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Firestore'da kullanıcı profili oluştur (ilk kayıtta)
async function ensureUserProfile(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      credits:      500,
      totalEarned:  500,
      totalSpent:   0,
      plan:         'free',
      createdAt:    serverTimestamp(),
    });

    const txRef = doc(db, 'users', uid, 'transactions', crypto.randomUUID());
    await setDoc(txRef, {
      type:        'earn',
      amount:      500,
      description: 'Hoş geldin kredisi',
      createdAt:   serverTimestamp(),
    });
  }
}

// Kullanıcı datasını standart formata çevir
function formatUser(user: User) {
  return {
    uid:         user.uid,
    email:       user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
    photoURL:    user.photoURL || null,
    isGuest:     user.isAnonymous,
    emailVerified: user.emailVerified,
  };
}

// Şifreyi şifrele (İşletim sistemi düzeyinde güvenli)
function encryptPassword(password: string): string | null {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    const buffer = safeStorage.encryptString(password);
    return buffer.toString('base64');
  }
  return null;
}

// Şifreyi çöz
function decryptPassword(encryptedBase64: string): string | null {
  if (safeStorage && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      log.error('Şifre çözme hatası:', error);
      return null;
    }
  }
  return null;
}

function base64UrlEncode(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = base64UrlEncode(randomBytes(64));
  const challenge = base64UrlEncode(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function getGoogleClientId(): string | null {
  const value = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  return value ? value : null;
}

function getGoogleClientSecret(): string | null {
  const value = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return value ? value : null;
}

interface GoogleRedirectConfig {
  uri: string;
  host: string;
  port: number;
  path: string;
}

function isLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === 'localhost'
    || normalized === '::1';
}

function getGoogleRedirectPort(): number {
  const parsed = Number(process.env.GOOGLE_OAUTH_REDIRECT_PORT ?? GOOGLE_OAUTH_DEFAULT_PORT);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : GOOGLE_OAUTH_DEFAULT_PORT;
}

function getGoogleRedirectConfig(): GoogleRedirectConfig {
  const explicitRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicitRedirectUri) {
    const parsed = new URL(explicitRedirectUri);
    if (parsed.protocol !== 'http:') {
      throw new Error('GOOGLE_OAUTH_REDIRECT_URI yalnızca http loopback adresi olabilir.');
    }

    if (!isLoopbackHost(parsed.hostname)) {
      throw new Error('GOOGLE_OAUTH_REDIRECT_URI yalnızca localhost, 127.0.0.1 veya ::1 kullanabilir.');
    }

    const port = Number(parsed.port || 80);
    return {
      uri: explicitRedirectUri,
      host: parsed.hostname,
      port,
      path: parsed.pathname || '/',
    };
  }

  const host = process.env.GOOGLE_OAUTH_REDIRECT_HOST?.trim() || '127.0.0.1';
  if (!isLoopbackHost(host)) {
    throw new Error('GOOGLE_OAUTH_REDIRECT_HOST yalnızca localhost, 127.0.0.1 veya ::1 olabilir.');
  }

  const port = getGoogleRedirectPort();
  return {
    uri: `http://${host}:${port}${GOOGLE_OAUTH_DEFAULT_PATH}`,
    host,
    port,
    path: GOOGLE_OAUTH_DEFAULT_PATH,
  };
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function getAuthErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  if (code) {
    return getErrorMessage(code);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Beklenmedik bir hata oluştu.';
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

function getGoogleAuthErrorMessage(error: unknown, redirectUri: string): string {
  const genericMessage = getAuthErrorMessage(error);
  const details = error instanceof Error ? error.message : '';

  if (details.includes('redirect_uri_mismatch')) {
    return `Google OAuth yönlendirme adresi eşleşmedi. Google Cloud Console içinde şu URI tanımlı olmalı: ${redirectUri}`;
  }

  if (details.includes('invalid_client')) {
    return 'Google OAuth istemcisi geçersiz görünüyor. GOOGLE_OAUTH_CLIENT_ID ve gerekiyorsa GOOGLE_OAUTH_CLIENT_SECRET değerlerini kontrol edin.';
  }

  if (details.includes('access_denied')) {
    return 'Google girişi kullanıcı tarafından iptal edildi.';
  }

  if (details.includes('Google geri dönüş portu')) {
    return `${details} . Gerekirse GOOGLE_OAUTH_REDIRECT_PORT veya GOOGLE_OAUTH_REDIRECT_URI ile farklı bir yönlendirme adresi tanımlayın.`;
  }

  if (details.includes('Google giriş zaman aşımına uğradı')) {
    return `Google girişi zaman aşımına uğradı. Google Cloud Console içinde şu yönlendirme adresinin tanımlı olduğundan emin olun: ${redirectUri}`;
  }

  return genericMessage;
}

async function ensureUserProfileSafely(user: User): Promise<void> {
  try {
    await ensureUserProfile(user);
  } catch (error) {
    log.warn('[auth] Kullanıcı profili oluşturulamadı:', error);
  }
}

function clearRememberedPassword(): void {
  store.delete('savedEmail');
  store.delete('encryptedPassword');
  store.set('rememberMe', false);
}

function buildLoopbackPage(message: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>Archilya Launcher</title></head><body style="font-family:Arial,sans-serif;background:#111;color:#f7d774;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="max-width:420px;text-align:center;"><h1 style="margin-bottom:12px;">Archilya Launcher</h1><p style="color:#f5f5f5;line-height:1.5;">${message}</p><p style="color:#9ca3af;font-size:14px;">Bu pencereyi kapatıp launchera dönebilirsiniz.</p></div></body></html>`;
}

async function waitForGoogleAuthorizationCode(config: GoogleRedirectConfig, expectedState: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', config.uri);

      if (requestUrl.pathname !== config.path) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }

      const state = requestUrl.searchParams.get('state');
      const code = requestUrl.searchParams.get('code');
      const oauthError = requestUrl.searchParams.get('error');

      if (oauthError) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(buildLoopbackPage('Google girişi iptal edildi ya da başarısız oldu.'));
        cleanup(new Error('Google girişi iptal edildi.'));
        return;
      }

      if (state !== expectedState) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(buildLoopbackPage('Güvenlik doğrulaması başarısız oldu. Lütfen tekrar deneyin.'));
        cleanup(new Error('Google doğrulama durumu eşleşmedi.'));
        return;
      }

      if (!code) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(buildLoopbackPage('Google doğrulama kodu alınamadı.'));
        cleanup(new Error('Google doğrulama kodu alınamadı.'));
        return;
      }

      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(buildLoopbackPage('Google girişi başarıyla tamamlandı.'));
      cleanup(undefined, code);
    });

    const timeout = setTimeout(() => {
      cleanup(new Error('Google giriş zaman aşımına uğradı. Tekrar deneyin.'));
    }, GOOGLE_OAUTH_TIMEOUT_MS);

    let settled = false;

    const cleanup = (error?: Error, code?: string) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      server.close(() => {
        if (error) {
          reject(error);
          return;
        }

        resolve(code ?? '');
      });
    };

    server.on('error', () => {
      cleanup(new Error(`Google geri dönüş portu (${config.port}) açılamadı.`));
    });

    server.listen(config.port, config.host);
  });
}

interface GoogleTokenResponse {
  access_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

async function exchangeGoogleAuthCode(
  clientId: string,
  clientSecret: string | null,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const requestBody = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  if (clientSecret) {
    requestBody.set('client_secret', clientSecret);
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestBody,
  });

  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok) {
    const message = payload.error_description || payload.error || 'Google token yanıtı alınamadı.';
    throw new Error(message);
  }

  return payload;
}

// ── Login ────────────────────────────────────────────────────────────────────
export async function loginWithEmail(
  email: string,
  password: string,
  rememberMe: boolean
) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
    await ensureUserProfileSafely(cred.user);
    if (rememberMe) {
      store.set('savedEmail', normalizedEmail);
      store.set('rememberMe', true);
      
      // Şifreyi güvenli bir şekilde sakla
      const encryptedPass = encryptPassword(password);
      if (encryptedPass) {
        store.set('encryptedPassword', encryptedPass);
      }
    } else {
      store.delete('savedEmail');
      store.set('rememberMe', false);
      store.delete('encryptedPassword');
    }
    return { success: true, user: formatUser(cred.user) };
  } catch (err: any) {
    return { success: false, error: getErrorMessage(err.code) };
  }
}

export async function loginWithGoogle(rememberMe: boolean) {
  void rememberMe;
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId) {
    return {
      success: false,
      error: 'Google girişi için GOOGLE_OAUTH_CLIENT_ID tanımlanmadı.',
    };
  }

  const redirectConfig = getGoogleRedirectConfig();
  const redirectUri = redirectConfig.uri;
  const state = base64UrlEncode(randomBytes(24));
  const { verifier, challenge } = createPkcePair();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  try {
    const authorizationCodePromise = waitForGoogleAuthorizationCode(redirectConfig, state);
    await shell.openExternal(authUrl.toString());

    const code = await authorizationCodePromise;
    const tokenResponse = await exchangeGoogleAuthCode(clientId, clientSecret, code, verifier, redirectUri);

    if (!tokenResponse.id_token) {
      throw new Error('Google kimlik doğrulama belirteci alınamadı.');
    }

    const credential = GoogleAuthProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
    const result = await signInWithCredential(auth, credential);
    await ensureUserProfileSafely(result.user);
    clearRememberedPassword();

    return { success: true, user: formatUser(result.user) };
  } catch (error: unknown) {
    return { success: false, error: getGoogleAuthErrorMessage(error, redirectUri) };
  }
}

// ── Register ─────────────────────────────────────────────────────────────────
export async function registerWithEmail(email: string, password: string) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    // Display name olarak email'in @ öncesi
    await updateProfile(cred.user, {
      displayName: normalizedEmail.split('@')[0],
    });
    await sendEmailVerification(cred.user);
    // Firestore profili oluştur (500 başlangıç kredisi)
    await ensureUserProfile(cred.user);
    return {
      success: true,
      message: 'Kayıt başarılı! Doğrulama bağlantısı e-posta adresinize gönderildi.',
    };
  } catch (err: any) {
    return { success: false, error: getErrorMessage(err.code) };
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────
export async function logout() {
  try {
    // Çıkış yaparken saklanan şifreyi sil, ancak emaili ve beni hatırla durumunu koru (isteğe bağlı)
    store.delete('encryptedPassword');
    store.set('rememberMe', false); // Çıkış yapıldıysa beni hatırla kapanır
    
    await signOut(auth);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Guest Login ──────────────────────────────────────────────────────────────
export async function loginGuest() {
  try {
    const cred = await signInAnonymously(auth);
    return { success: true, user: formatUser(cred.user) };
  } catch (err: any) {
    return { success: false, error: getErrorMessage(err.code) };
  }
}

// ── Reset Password ───────────────────────────────────────────────────────────
export async function resetPassword(email: string) {
  try {
    const normalizedEmail = normalizeEmail(email);
    auth.languageCode = 'tr';

    try {
      const signInMethods = await withTimeout(
        fetchSignInMethodsForEmail(auth, normalizedEmail),
        PASSWORD_RESET_TIMEOUT_MS,
        'Şifre sıfırlama ön kontrolü zaman aşımına uğradı.',
      );
      if (signInMethods.length > 0 && !signInMethods.includes('password')) {
        return {
          success: false,
          error: 'Bu hesap e-posta/şifre ile değil, farklı bir giriş yöntemiyle oluşturulmuş.',
        };
      }
    } catch (error) {
      log.warn('[auth] Şifre sıfırlama ön kontrolü atlandı:', error);
    }

    await withTimeout(
      sendPasswordResetEmail(auth, normalizedEmail),
      PASSWORD_RESET_TIMEOUT_MS,
      'Şifre sıfırlama isteği zaman aşımına uğradı. Lütfen tekrar deneyin.',
    );
    return {
      success: true,
      message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
    };
  } catch (err: any) {
    return { success: false, error: getErrorMessage(err.code) };
  }
}

// ── Check Session ────────────────────────────────────────────────────────────
// Uygulama açılışında mevcut oturumu kontrol et
export function checkSession(): Promise<ReturnType<typeof formatUser> | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      
      if (user) {
        resolve(formatUser(user));
      } else {
        // Firebase in-memory oturumu yok (uygulama yeni açılmış olabilir)
        // Otomatik giriş (Auto-login) kontrolü yap
        const rememberMe = store.get('rememberMe');
        const savedEmail = store.get('savedEmail');
        const encryptedPass = store.get('encryptedPassword');
        
        if (rememberMe && savedEmail && encryptedPass) {
          const decryptedPass = decryptPassword(encryptedPass);
          
          if (decryptedPass) {
            try {
              // Sessizce tekrar giriş yap
              const cred = await signInWithEmailAndPassword(auth, savedEmail, decryptedPass);
              resolve(formatUser(cred.user));
              return;
            } catch (autoLoginErr) {
              log.error('Otomatik giriş başarısız:', autoLoginErr);
              // Otomatik giriş başarısız olursa geçersiz verileri temizle
              store.delete('encryptedPassword');
              store.set('rememberMe', false);
            }
          }
        }
        
        resolve(null);
      }
    });
  });
}

// Kaydedilmiş email'i getir (rememberMe için)
export function getSavedEmail(): string {
  return store.get('rememberMe') ? (store.get('savedEmail') || '') : '';
}

// Mevcut kullanıcıyı getir
export function getCurrentUser() {
  const user = auth.currentUser;
  return user ? formatUser(user) : null;
}
