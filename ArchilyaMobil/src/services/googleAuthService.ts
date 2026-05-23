import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';

export type AuthResultLike = {
  type?: string;
  params?: Record<string, string | undefined>;
  authentication?: {
    idToken?: string | null;
    accessToken?: string | null;
  } | null;
  error?: {
    message?: string;
    code?: string;
  } | null;
  errorCode?: string | null;
};

export type GoogleAuthConfig = {
  expoClientId: string;
  androidClientId: string;
  iosClientId: string;
  webClientId: string;
  nativeScheme: string;
};

let configuredGoogleWebClientId = '';

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  const extra =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined) ||
    (((Constants as unknown as Record<string, unknown>).manifest as Record<string, unknown> | undefined)?.extra as Record<string, unknown> | undefined) ||
    (((Constants as unknown as Record<string, unknown>).manifest2 as Record<string, unknown> | undefined)?.extra as Record<string, unknown> | undefined) ||
    {};

  const config = (extra.googleAuth || {}) as Record<string, unknown>;
  const fallbackScheme = normalizeText(Constants.expoConfig?.scheme) || 'archilya';

  return {
    expoClientId: normalizeText(config.expoClientId),
    androidClientId: normalizeText(config.androidClientId),
    iosClientId: normalizeText(config.iosClientId),
    webClientId: normalizeText(config.webClientId),
    nativeScheme: normalizeText(config.nativeScheme) || fallbackScheme,
  };
}

export function isGoogleAuthConfigured(config: GoogleAuthConfig) {
  return Boolean(config.webClientId || config.expoClientId || config.androidClientId || config.iosClientId);
}

export function buildGoogleAuthRequestConfig(config: GoogleAuthConfig) {
  return {
    // expoClientId: Expo Go development için
    expoClientId: config.expoClientId || undefined,
    // androidClientId: EAS/standalone Android build için
    androidClientId: config.androidClientId || undefined,
    // iosClientId: iOS build için
    iosClientId: config.iosClientId || undefined,
    // webClientId: Firebase'in idToken doğrulaması için gerekli — web tipi OAuth client
    webClientId: config.webClientId || undefined,
    scopes: ['profile', 'email'],
    selectAccount: true,
  };
}

export function buildGoogleAuthRedirectOptions(config: GoogleAuthConfig) {
  const nativeScheme = normalizeText(config.nativeScheme) || 'com.archilya.app';
  return {
    native: `${nativeScheme}:/oauthredirect`,
  };
}

function ensureNativeGoogleSigninConfigured(config: GoogleAuthConfig) {
  const webClientId = normalizeText(config.webClientId || config.expoClientId);

  if (!webClientId) {
    throw new Error('Google web client ID eksik. Native Google girisi icin web client ID gerekli.');
  }

  if (configuredGoogleWebClientId === webClientId) {
    return;
  }

  GoogleSignin.configure({
    webClientId,
    scopes: ['profile', 'email'],
    offlineAccess: true,
    forceCodeForRefreshToken: true,
    accountName: '',
  });

  configuredGoogleWebClientId = webClientId;
}

export async function signInWithGoogleNative(config: GoogleAuthConfig) {
  if (Platform.OS !== 'android') {
    throw new Error('Native Google girisi bu platformda etkin degil.');
  }

  ensureNativeGoogleSigninConfigured(config);
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const signInResult = await GoogleSignin.signIn();
  if (signInResult.type === 'cancelled') {
    return { cancelled: true, idToken: '', accessToken: '' };
  }

  const tokens = await GoogleSignin.getTokens();

  return {
    cancelled: false,
    idToken: normalizeText(tokens.idToken || signInResult.data.idToken),
    accessToken: normalizeText(tokens.accessToken),
  };
}

export function extractGoogleTokens(authResult: AuthResultLike | null | undefined) {
  return {
    idToken: normalizeText(authResult?.params?.id_token || authResult?.authentication?.idToken),
    accessToken: normalizeText(authResult?.params?.access_token || authResult?.authentication?.accessToken),
  };
}

export function getGoogleAuthErrorMessage(errorLike: unknown) {
  const result = (errorLike || {}) as AuthResultLike;
  const directMessage = normalizeText((errorLike as { message?: string })?.message || result?.error?.message);
  const resultError = normalizeText(result?.params?.error || result?.error?.code || result?.errorCode);
  const resultErrorDescription = normalizeText(result?.params?.error_description || result?.params?.errorMessage);

  if (isErrorWithCode(errorLike)) {
    if (errorLike.code === statusCodes.SIGN_IN_CANCELLED) {
      return 'Google girisi iptal edildi.';
    }

    if (errorLike.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return 'Google Play Servisleri kullanilabilir degil. Cihazinizi guncelleyip tekrar deneyin.';
    }

    if (errorLike.code === statusCodes.IN_PROGRESS) {
      return 'Google girisi zaten devam ediyor. Lutfen bekleyip tekrar deneyin.';
    }
  }

  const combined = normalizeLower([directMessage, resultError, resultErrorDescription].filter(Boolean).join(' '));

  if (combined.includes('cancel') || combined.includes('dismiss') || combined.includes('iptal')) {
    return 'Google girisi iptal edildi.';
  }

  if (combined.includes('network') || combined.includes('internet')) {
    return 'Google girisi sirasinda baglanti hatasi olustu. Internet baglantinizi kontrol edip tekrar deneyin.';
  }

  if (
    combined.includes('developer_error') ||
    combined.includes('invalid_request') ||
    combined.includes('invalid_audience') ||
    combined.includes('unauthorized_client')
  ) {
    return 'Google OAuth ayarlari gecersiz. Android package adi, SHA-1/SHA-256 ve client ID eslesmesini kontrol edin. (EAS build ise: expo credentials:manager ile keystore SHA-1ini Firebase Consolea ekleyin; Play Store ise: Play Console > App Integrity > App signing key certificate SHA-1ini ekleyin.)';
  }

  if (combined.includes('redirect_uri_mismatch')) {
    return 'Google OAuth yonlendirme ayari hatali. Uygulama scheme ve redirect URI ayarlari kontrol edilmeli.';
  }

  if (combined.includes('invalid credential') || combined.includes('auth/invalid-credential')) {
    return 'Google token dogrulanamadi. Web client ID ve Firebase Google giris ayarlari kontrol edilmeli.';
  }

  if (resultErrorDescription) {
    return resultErrorDescription;
  }
  if (directMessage) {
    return directMessage;
  }
  if (resultError) {
    return resultError;
  }

  return 'Google ile kimlik dogrulama basarisiz oldu.';
}

export function getGoogleSetupHintText() {
  return 'Firebase ve Google Cloud tarafinda Android OAuth client kaydinda package adi ile SHA-1/SHA-256 eslesmeli; native Google girisi icin web client ID de dogru olmali.';
}
