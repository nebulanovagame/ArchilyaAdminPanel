import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Production'da .env asar içine girmez; config doğrudan burada sabitlendi.
// Bu değerler zaten Firebase Console'da herkese açık client-side config'dir.
const firebaseConfig = {
  apiKey:            'AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM',
  authDomain:        'nng-toma.firebaseapp.com',
  projectId:         'nng-toma',
  storageBucket:     'nng-toma.firebasestorage.app',
  messagingSenderId: '782938691094',
  appId:             '1:782938691094:web:4074295e7a44a57954c737',
};

// Birden fazla init'i önle
const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth    = getAuth(app);
export const db      = getFirestore(app);

// Offline persistence (çevrimdışı destek)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[Firebase] Coklu sekme acik — offline persistence aktif degil.');
  } else if (err.code === 'unimplemented') {
    console.warn('[Firebase] Tarayici IndexedDB desteklemiyor.');
  }
});

export const functions = getFunctions(app, 'europe-west1');
export const storage = getStorage(app);
export const LAUNCHER_COMMANDS_COLLECTION = 'launcherCommands';

export function getLauncherCommandsCollection() {
  return collection(db, LAUNCHER_COMMANDS_COLLECTION);
}

export default app;
