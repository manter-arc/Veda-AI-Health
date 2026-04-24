import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Use initializeFirestore with optimized settings for restricted environments (iframes/sandboxes)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Initialize Gemini AI
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default app;
