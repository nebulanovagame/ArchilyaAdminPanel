import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getReactNativePersistence, initializeAuth } from '@firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM',
  authDomain: 'nng-toma.firebaseapp.com',
  projectId: 'nng-toma',
  storageBucket: 'nng-toma.firebasestorage.app',
  messagingSenderId: '782938691094',
  appId: '1:782938691094:web:4074295e7a44a57954c737',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

const storage = getStorage(app);

export { app, auth, db, storage };
