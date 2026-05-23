"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithEmail = loginWithEmail;
exports.loginWithGoogle = loginWithGoogle;
exports.registerWithEmail = registerWithEmail;
exports.logout = logout;
exports.loginGuest = loginGuest;
exports.resetPassword = resetPassword;
exports.checkSession = checkSession;
exports.getSavedEmail = getSavedEmail;
exports.getCurrentUser = getCurrentUser;
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
const firebase_1 = require("../firebase");
const electron_store_1 = __importDefault(require("electron-store"));
const electron_1 = require("electron");
const node_http_1 = require("node:http");
const node_crypto_1 = require("node:crypto");
const electron_log_1 = __importDefault(require("electron-log"));
// Session persistence için electron-store
const store = new electron_store_1.default();
const GOOGLE_OAUTH_TIMEOUT_MS = 120_000;
const PASSWORD_RESET_TIMEOUT_MS = 20_000;
const GOOGLE_OAUTH_DEFAULT_PORT = 47193;
const GOOGLE_OAUTH_DEFAULT_PATH = '/google-auth/callback';
// Firebase hata kodlarını Türkçe'ye çevir
function getErrorMessage(code) {
    const map = {
        'auth/user-not-found': 'Bu e-posta adresiyle kayıtlı hesap bulunamadı.',
        'auth/wrong-password': 'Şifre hatalı.',
        'auth/invalid-email': 'Geçersiz e-posta adresi.',
        'auth/user-disabled': 'Bu hesap devre dışı bırakılmış.',
        'auth/email-already-in-use': 'Bu e-posta adresi zaten kullanımda.',
        'auth/weak-password': 'Şifre en az 6 karakter olmalıdır.',
        'auth/too-many-requests': 'Çok fazla başarısız deneme. Lütfen bekleyin.',
        'auth/network-request-failed': 'İnternet bağlantısı yok.',
        'auth/invalid-credential': 'E-posta veya şifre hatalı.',
        'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase üzerinde etkin değil.',
        'auth/missing-email': 'Lütfen bir e-posta adresi girin.',
    };
    return map[code] || 'Beklenmedik bir hata oluştu.';
}
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
// Firestore'da kullanıcı profili oluştur (ilk kayıtta)
async function ensureUserProfile(user) {
    const ref = (0, firestore_1.doc)(firebase_1.db, 'users', user.uid);
    const snap = await (0, firestore_1.getDoc)(ref);
    if (!snap.exists()) {
        await (0, firestore_1.setDoc)(ref, {
            credits: 500,
            totalEarned: 500,
            totalSpent: 0,
            plan: 'free',
            createdAt: (0, firestore_1.serverTimestamp)(),
            creditHistory: [{
                    type: 'earn',
                    amount: 500,
                    description: 'Hoş geldin kredisi',
                    createdAt: new Date().toISOString(),
                }],
        });
    }
}
// Kullanıcı datasını standart formata çevir
function formatUser(user) {
    return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
        photoURL: user.photoURL || null,
        isGuest: user.isAnonymous,
        emailVerified: user.emailVerified,
    };
}
// Şifreyi şifrele (İşletim sistemi düzeyinde güvenli)
function encryptPassword(password) {
    if (electron_1.safeStorage && electron_1.safeStorage.isEncryptionAvailable()) {
        const buffer = electron_1.safeStorage.encryptString(password);
        return buffer.toString('base64');
    }
    return null;
}
// Şifreyi çöz
function decryptPassword(encryptedBase64) {
    if (electron_1.safeStorage && electron_1.safeStorage.isEncryptionAvailable()) {
        try {
            const buffer = Buffer.from(encryptedBase64, 'base64');
            return electron_1.safeStorage.decryptString(buffer);
        }
        catch (error) {
            electron_log_1.default.error('Şifre çözme hatası:', error);
            return null;
        }
    }
    return null;
}
function base64UrlEncode(input) {
    return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function createPkcePair() {
    const verifier = base64UrlEncode((0, node_crypto_1.randomBytes)(64));
    const challenge = base64UrlEncode((0, node_crypto_1.createHash)('sha256').update(verifier).digest());
    return { verifier, challenge };
}
function getGoogleClientId() {
    const value = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    return value ? value : null;
}
function getGoogleClientSecret() {
    const value = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    return value ? value : null;
}
function isLoopbackHost(host) {
    const normalized = host.trim().toLowerCase();
    return normalized === '127.0.0.1'
        || normalized === 'localhost'
        || normalized === '::1';
}
function getGoogleRedirectPort() {
    const parsed = Number(process.env.GOOGLE_OAUTH_REDIRECT_PORT ?? GOOGLE_OAUTH_DEFAULT_PORT);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : GOOGLE_OAUTH_DEFAULT_PORT;
}
function getGoogleRedirectConfig() {
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
function readErrorCode(error) {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
        return null;
    }
    const code = error.code;
    return typeof code === 'string' ? code : null;
}
function getAuthErrorMessage(error) {
    const code = readErrorCode(error);
    if (code) {
        return getErrorMessage(code);
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Beklenmedik bir hata oluştu.';
}
async function withTimeout(promise, timeoutMs, message) {
    return await Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
    ]);
}
function getGoogleAuthErrorMessage(error, redirectUri) {
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
async function ensureUserProfileSafely(user) {
    try {
        await ensureUserProfile(user);
    }
    catch (error) {
        electron_log_1.default.warn('[auth] Kullanıcı profili oluşturulamadı:', error);
    }
}
function clearRememberedPassword() {
    store.delete('savedEmail');
    store.delete('encryptedPassword');
    store.set('rememberMe', false);
}
function buildLoopbackPage(message) {
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>Archilya Launcher</title></head><body style="font-family:Arial,sans-serif;background:#111;color:#f7d774;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="max-width:420px;text-align:center;"><h1 style="margin-bottom:12px;">Archilya Launcher</h1><p style="color:#f5f5f5;line-height:1.5;">${message}</p><p style="color:#9ca3af;font-size:14px;">Bu pencereyi kapatıp launchera dönebilirsiniz.</p></div></body></html>`;
}
async function waitForGoogleAuthorizationCode(config, expectedState) {
    return await new Promise((resolve, reject) => {
        const server = (0, node_http_1.createServer)((request, response) => {
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
        const cleanup = (error, code) => {
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
async function exchangeGoogleAuthCode(clientId, clientSecret, code, codeVerifier, redirectUri) {
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
    const payload = await response.json();
    if (!response.ok) {
        const message = payload.error_description || payload.error || 'Google token yanıtı alınamadı.';
        throw new Error(message);
    }
    return payload;
}
// ── Login ────────────────────────────────────────────────────────────────────
async function loginWithEmail(email, password, rememberMe) {
    try {
        const normalizedEmail = normalizeEmail(email);
        const cred = await (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, normalizedEmail, password);
        await ensureUserProfileSafely(cred.user);
        if (rememberMe) {
            store.set('savedEmail', normalizedEmail);
            store.set('rememberMe', true);
            // Şifreyi güvenli bir şekilde sakla
            const encryptedPass = encryptPassword(password);
            if (encryptedPass) {
                store.set('encryptedPassword', encryptedPass);
            }
        }
        else {
            store.delete('savedEmail');
            store.set('rememberMe', false);
            store.delete('encryptedPassword');
        }
        return { success: true, user: formatUser(cred.user) };
    }
    catch (err) {
        return { success: false, error: getErrorMessage(err.code) };
    }
}
async function loginWithGoogle(rememberMe) {
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
    const state = base64UrlEncode((0, node_crypto_1.randomBytes)(24));
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
        await electron_1.shell.openExternal(authUrl.toString());
        const code = await authorizationCodePromise;
        const tokenResponse = await exchangeGoogleAuthCode(clientId, clientSecret, code, verifier, redirectUri);
        if (!tokenResponse.id_token) {
            throw new Error('Google kimlik doğrulama belirteci alınamadı.');
        }
        const credential = auth_1.GoogleAuthProvider.credential(tokenResponse.id_token, tokenResponse.access_token);
        const result = await (0, auth_1.signInWithCredential)(firebase_1.auth, credential);
        await ensureUserProfileSafely(result.user);
        clearRememberedPassword();
        return { success: true, user: formatUser(result.user) };
    }
    catch (error) {
        return { success: false, error: getGoogleAuthErrorMessage(error, redirectUri) };
    }
}
// ── Register ─────────────────────────────────────────────────────────────────
async function registerWithEmail(email, password) {
    try {
        const normalizedEmail = normalizeEmail(email);
        const cred = await (0, auth_1.createUserWithEmailAndPassword)(firebase_1.auth, normalizedEmail, password);
        // Display name olarak email'in @ öncesi
        await (0, auth_1.updateProfile)(cred.user, {
            displayName: normalizedEmail.split('@')[0],
        });
        await (0, auth_1.sendEmailVerification)(cred.user);
        // Firestore profili oluştur (500 başlangıç kredisi)
        await ensureUserProfile(cred.user);
        return {
            success: true,
            message: 'Kayıt başarılı! Doğrulama bağlantısı e-posta adresinize gönderildi.',
        };
    }
    catch (err) {
        return { success: false, error: getErrorMessage(err.code) };
    }
}
// ── Logout ───────────────────────────────────────────────────────────────────
async function logout() {
    try {
        // Çıkış yaparken saklanan şifreyi sil, ancak emaili ve beni hatırla durumunu koru (isteğe bağlı)
        store.delete('encryptedPassword');
        store.set('rememberMe', false); // Çıkış yapıldıysa beni hatırla kapanır
        await (0, auth_1.signOut)(firebase_1.auth);
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
// ── Guest Login ──────────────────────────────────────────────────────────────
async function loginGuest() {
    try {
        const cred = await (0, auth_1.signInAnonymously)(firebase_1.auth);
        return { success: true, user: formatUser(cred.user) };
    }
    catch (err) {
        return { success: false, error: getErrorMessage(err.code) };
    }
}
// ── Reset Password ───────────────────────────────────────────────────────────
async function resetPassword(email) {
    try {
        const normalizedEmail = normalizeEmail(email);
        firebase_1.auth.languageCode = 'tr';
        try {
            const signInMethods = await withTimeout((0, auth_1.fetchSignInMethodsForEmail)(firebase_1.auth, normalizedEmail), PASSWORD_RESET_TIMEOUT_MS, 'Şifre sıfırlama ön kontrolü zaman aşımına uğradı.');
            if (signInMethods.length > 0 && !signInMethods.includes('password')) {
                return {
                    success: false,
                    error: 'Bu hesap e-posta/şifre ile değil, farklı bir giriş yöntemiyle oluşturulmuş.',
                };
            }
        }
        catch (error) {
            electron_log_1.default.warn('[auth] Şifre sıfırlama ön kontrolü atlandı:', error);
        }
        await withTimeout((0, auth_1.sendPasswordResetEmail)(firebase_1.auth, normalizedEmail), PASSWORD_RESET_TIMEOUT_MS, 'Şifre sıfırlama isteği zaman aşımına uğradı. Lütfen tekrar deneyin.');
        return {
            success: true,
            message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
        };
    }
    catch (err) {
        return { success: false, error: getErrorMessage(err.code) };
    }
}
// ── Check Session ────────────────────────────────────────────────────────────
// Uygulama açılışında mevcut oturumu kontrol et
function checkSession() {
    return new Promise((resolve) => {
        const unsubscribe = (0, auth_1.onAuthStateChanged)(firebase_1.auth, async (user) => {
            unsubscribe();
            if (user) {
                resolve(formatUser(user));
            }
            else {
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
                            const cred = await (0, auth_1.signInWithEmailAndPassword)(firebase_1.auth, savedEmail, decryptedPass);
                            resolve(formatUser(cred.user));
                            return;
                        }
                        catch (autoLoginErr) {
                            electron_log_1.default.error('Otomatik giriş başarısız:', autoLoginErr);
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
function getSavedEmail() {
    return store.get('rememberMe') ? (store.get('savedEmail') || '') : '';
}
// Mevcut kullanıcıyı getir
function getCurrentUser() {
    const user = firebase_1.auth.currentUser;
    return user ? formatUser(user) : null;
}
