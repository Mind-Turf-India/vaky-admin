import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyD9_hO4iS2mv5rg93xti21cYZUxvx0MSro",
    authDomain: "mind-turf.firebaseapp.com",
    databaseURL: "https://mind-turf-default-rtdb.firebaseio.com",
    projectId: "mind-turf",
    storageBucket: "mind-turf.firebasestorage.app",
    messagingSenderId: "782461473266",
    appId: "1:782461473266:web:dd271f8186852629f19b6b",
    measurementId: "G-DGRNHDBCMB"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
