import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.projectId) {
  console.error("Firebase config is missing. Pastikan variabel VITE_ di file .env sudah diatur.");
}

let app;
if (getApps().length > 0) {
  app = getApps()[0];
  if (app.options.projectId !== firebaseConfig.projectId) {
    deleteApp(app);
    app = initializeApp(firebaseConfig);
  }
} else {
  app = initializeApp(firebaseConfig);
}

export const db = getFirestore(app);