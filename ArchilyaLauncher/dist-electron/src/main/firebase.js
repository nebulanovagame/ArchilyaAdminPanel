"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAUNCHER_COMMANDS_COLLECTION = exports.storage = exports.functions = exports.db = exports.auth = void 0;
exports.getLauncherCommandsCollection = getLauncherCommandsCollection;
const app_1 = require("firebase/app");
const auth_1 = require("firebase/auth");
const firestore_1 = require("firebase/firestore");
const functions_1 = require("firebase/functions");
const storage_1 = require("firebase/storage");
// Production'da .env asar içine girmez; config doğrudan burada sabitlendi.
// Bu değerler zaten Firebase Console'da herkese açık client-side config'dir.
const firebaseConfig = {
    apiKey: 'AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM',
    authDomain: 'nng-toma.firebaseapp.com',
    projectId: 'nng-toma',
    storageBucket: 'nng-toma.firebasestorage.app',
    messagingSenderId: '782938691094',
    appId: '1:782938691094:web:4074295e7a44a57954c737',
};
// Birden fazla init'i önle
const app = (0, app_1.getApps)().length === 0
    ? (0, app_1.initializeApp)(firebaseConfig)
    : (0, app_1.getApps)()[0];
exports.auth = (0, auth_1.getAuth)(app);
exports.db = (0, firestore_1.getFirestore)(app);
// Offline persistence (çevrimdışı destek)
(0, firestore_1.enableIndexedDbPersistence)(exports.db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Coklu sekme acik — offline persistence aktif degil.');
    }
    else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Tarayici IndexedDB desteklemiyor.');
    }
});
exports.functions = (0, functions_1.getFunctions)(app, 'europe-west1');
exports.storage = (0, storage_1.getStorage)(app);
exports.LAUNCHER_COMMANDS_COLLECTION = 'launcherCommands';
function getLauncherCommandsCollection() {
    return (0, firestore_1.collection)(exports.db, exports.LAUNCHER_COMMANDS_COLLECTION);
}
exports.default = app;
