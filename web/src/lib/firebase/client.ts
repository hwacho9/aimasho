"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";
import { Auth, connectAuthEmulator, getAuth, GoogleAuthProvider, linkWithPopup, reauthenticateWithPopup, signInAnonymously, signInWithPopup, User } from "firebase/auth";
import { connectFirestoreEmulator, Firestore, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, Functions, getFunctions } from "firebase/functions";

interface FirebaseServices {
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

let emulatorConnected = false;
let analyticsPromise: Promise<Analytics | null> | undefined;

// Next.js replaces public environment variables in browser bundles only when
// they are referenced statically. Do not use process.env[name] here: that
// would work on the server but leave every client-side Firebase value empty.
const publicEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  NEXT_PUBLIC_USE_FIREBASE_EMULATOR: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR,
} as const;

function environment(name: keyof typeof publicEnvironment): string {
  const value = publicEnvironment[name];
  if (!value) throw new Error("Firebase is not configured. Add values to web/.env.local from web/.env.example.");
  return value;
}

function getAppInstance(): FirebaseApp {
  const config = {
    apiKey: environment("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: environment("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: environment("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: environment("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: environment("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: environment("NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: publicEnvironment.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  return getApps().length ? getApp() : initializeApp(config);
}

export function firebase(): FirebaseServices {
  const app = getAppInstance();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, "asia-northeast1");
  if (publicEnvironment.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true" && !emulatorConnected) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    emulatorConnected = true;
  }
  return { auth, db, functions };
}

/**
 * Analytics is optional so the app remains usable in local Firebase/emulator
 * setups. It is deliberately disabled for emulators because their test events
 * should never reach the production Analytics property.
 */
export function initializeAnalytics(): Promise<Analytics | null> {
  const hasFirebaseConfiguration = [
    publicEnvironment.NEXT_PUBLIC_FIREBASE_API_KEY,
    publicEnvironment.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    publicEnvironment.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    publicEnvironment.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    publicEnvironment.NEXT_PUBLIC_FIREBASE_APP_ID,
  ].every(Boolean);
  if (typeof window === "undefined" || !hasFirebaseConfiguration || !publicEnvironment.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || publicEnvironment.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true") {
    return Promise.resolve(null);
  }
  analyticsPromise ??= isSupported()
    .then((supported) => supported ? getAnalytics(getAppInstance()) : null)
    .catch(() => null);
  return analyticsPromise;
}

/** Logs product behavior only. Do not pass names, titles, locations, IDs, or amounts. */
export function trackAnalyticsEvent(name: string): void {
  void initializeAnalytics().then((analytics) => {
    if (analytics) logEvent(analytics, name);
  });
}

export async function ensureAnonymousUser(): Promise<User> {
  const { auth } = firebase();
  return auth.currentUser ?? (await signInAnonymously(auth)).user;
}

/** Upgrades the anonymous account in place so meetup relationships remain intact. */
export async function continueWithGoogle(): Promise<User> {
  const { auth } = firebase();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;

  // When Firebase restores an existing Google session, opening another popup
  // makes the login button look unresponsive. The signed-in user is already
  // the result we need.
  if (current && !current.isAnonymous && current.providerData.some((item) => item.providerId === "google.com")) return current;

  if (current?.isAnonymous) {
    try {
      return (await linkWithPopup(current, provider)).user;
    } catch (caught) {
      // A guest may try to connect a Google account that was used before.
      // Linking cannot merge two Firebase users, but signing into that account
      // is still a valid login and must not leave the UI on the same screen.
      const code = typeof caught === "object" && caught && "code" in caught ? String(caught.code) : "";
      if (code !== "auth/credential-already-in-use" && code !== "auth/email-already-in-use") throw caught;
      return (await signInWithPopup(auth, provider)).user;
    }
  }

  return (await signInWithPopup(auth, provider)).user;
}

/**
 * Requests a short-lived Calendar read scope only after the user explicitly
 * asks for it. The access token is intentionally returned to the caller and
 * is never sent to Firestore or Cloud Functions.
 */
export async function requestGoogleCalendarAccessToken(): Promise<string> {
  const { auth } = firebase();
  const user = auth.currentUser;
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/calendar.events.readonly");
  provider.setCustomParameters({ prompt: "consent" });
  const result = user?.isAnonymous
    ? await linkWithPopup(user, provider)
    : user?.providerData.some((item) => item.providerId === "google.com")
      ? await reauthenticateWithPopup(user, provider)
      : user
        ? await linkWithPopup(user, provider)
        : await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) throw new Error("Google Calendar 접근 토큰을 받지 못했습니다.");
  return credential.accessToken;
}
