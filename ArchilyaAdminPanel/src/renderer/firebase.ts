import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCfmz3gjf_x3iQ5Ud_mJ-kHjOTpEmDYQtM",
  authDomain: "nng-toma.firebaseapp.com",
  projectId: "nng-toma",
  storageBucket: "nng-toma.firebasestorage.app",
  messagingSenderId: "782938691094",
  appId: "1:782938691094:web:4074295e7a44a57954c737"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const storage = getStorage(app);
