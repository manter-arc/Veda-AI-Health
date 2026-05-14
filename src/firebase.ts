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
// experimentalForceLongPolling: true is essential for AI Studio preview to bypass iframe/proxy restrictions
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  ignoreUndefinedProperties: true,
  localCache: memoryLocalCache()
}, firebaseConfig.firestoreDatabaseId);

// Test connection as required by instructions
// This helps verify that the databaseId and projectId are correctly configured
async function testConnection() {
  try {
    const testDoc = doc(db, '_connection_test_', 'ping');
    await getDocFromServer(testDoc);
    console.log("Firestore connection test: SUCCESS");
  } catch (error: any) {
    console.error("Firestore connection test: FAILED", {
      code: error.code,
      message: error.message,
      databaseId: firebaseConfig.firestoreDatabaseId,
      projectId: firebaseConfig.projectId
    });
    
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.warn("Firestore appears to be unreachable. This may be due to browser restrictions or the database still being provisioned.");
    }
  }
}

testConnection();

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Initialize Gemini AI
export const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || 'missing-key' });

export default app;
