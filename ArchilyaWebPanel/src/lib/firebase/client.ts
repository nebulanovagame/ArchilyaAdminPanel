import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { initializeFirestore, type Firestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getAnalytics, type Analytics } from "firebase/analytics";

type ClientFirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
};

const CLIENT_ENV_NAMES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const satisfies ReadonlyArray<keyof NodeJS.ProcessEnv>;

function readClientFirebaseConfig(): ClientFirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  };
}

function isPlaceholderConfig(config: ClientFirebaseConfig) {
  return (
    config.apiKey === "demo-key"
    || config.projectId === "demo-project"
    || config.authDomain === "demo.firebaseapp.com"
    || config.messagingSenderId === "1234567890"
    || config.appId === "1:1234567890:web:demo"
  );
}

export function getMissingClientEnvNames() {
  const config = readClientFirebaseConfig();

  return CLIENT_ENV_NAMES.filter((name) => {
    switch (name) {
      case "NEXT_PUBLIC_FIREBASE_API_KEY":
        return !config.apiKey;
      case "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN":
        return !config.authDomain;
      case "NEXT_PUBLIC_FIREBASE_PROJECT_ID":
        return !config.projectId;
      case "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET":
        return !config.storageBucket;
      case "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID":
        return !config.messagingSenderId;
      case "NEXT_PUBLIC_FIREBASE_APP_ID":
        return !config.appId;
      default:
        return true;
    }
  });
}

export function isFirebaseClientConfigured() {
  return (
    getMissingClientEnvNames().length === 0
    && !isPlaceholderConfig(readClientFirebaseConfig())
  );
}

export function isFirebaseAnalyticsConfigured() {
  return isFirebaseClientConfigured() && Boolean(readClientFirebaseConfig().measurementId);
}

export function getFirebaseClientConfigurationError() {
  const missingEnvNames = getMissingClientEnvNames();

  if (!missingEnvNames.length) {
    if (isPlaceholderConfig(readClientFirebaseConfig())) {
      return "Firebase client ayarları demo placeholder durumda. Gerçek NEXT_PUBLIC_FIREBASE_* değerlerini girin.";
    }

    return "";
  }

  return `Firebase client env ayarları eksik: ${missingEnvNames.join(", ")}.`;
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseFirestore: Firestore | null = null;
let firebaseFunctions: Functions | null = null;
let firebaseStorage: FirebaseStorage | null = null;
let firebaseAnalytics: Analytics | null = null;

const FIREBASE_FUNCTIONS_REGION = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_REGION ?? "europe-west1";

export function getFirebaseApp() {
  if (!isFirebaseClientConfigured()) {
    throw new Error(getFirebaseClientConfigurationError());
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length
      ? getApp()
      : initializeApp(readClientFirebaseConfig());
  }

  return firebaseApp;
}

export function getFirebaseAuth() {
  if (!firebaseAuth) {
    firebaseAuth = getAuth(getFirebaseApp());
  }

  return firebaseAuth;
}

export function getGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}

export function getFirebaseFirestore() {
  if (!firebaseFirestore) {
    const app = getFirebaseApp();
    if (typeof window !== "undefined") {
      firebaseFirestore = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } else {
      firebaseFirestore = initializeFirestore(app, {});
    }
  }

  return firebaseFirestore;
}

export function getFirebaseFunctions() {
  if (!firebaseFunctions) {
    firebaseFunctions = getFunctions(getFirebaseApp(), FIREBASE_FUNCTIONS_REGION);
  }

  return firebaseFunctions;
}

export function getFirebaseStorage() {
  if (!firebaseStorage) {
    firebaseStorage = getStorage(getFirebaseApp());
  }

  return firebaseStorage;
}

export function getFirebaseAnalytics() {
  if (!isFirebaseAnalyticsConfigured()) {
    return null;
  }

  if (!firebaseAnalytics && typeof window !== "undefined") {
    firebaseAnalytics = getAnalytics(getFirebaseApp());
  }

  return firebaseAnalytics;
}
