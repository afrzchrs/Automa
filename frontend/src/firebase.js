import { initializeApp, getApps, deleteApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Reset app lama jika ada inisialisasi placeholder yang tersangkut
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