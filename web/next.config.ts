import type { NextConfig } from "next";

type FirebaseWebAppConfig = {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  messagingSenderId?: string;
  projectId?: string;
  storageBucket?: string;
};

function appHostingFirebaseConfig(): FirebaseWebAppConfig {
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (!raw) return {};

  try {
    const config: unknown = JSON.parse(raw);
    return config && typeof config === "object" ? config as FirebaseWebAppConfig : {};
  } catch {
    return {};
  }
}

const appHostingConfig = appHostingFirebaseConfig();

const nextConfig: NextConfig = {
  // Keep stale ISR shells for at most one hour. The default one-year window
  // can otherwise leave an old JavaScript entrypoint visible after a rollout.
  expireTime: 60 * 60,
  // App Hosting supplies FIREBASE_WEBAPP_CONFIG during builds. These mappings
  // expose its public Firebase settings to the browser, while .env.local keeps
  // taking precedence during local development.
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? appHostingConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? appHostingConfig.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? appHostingConfig.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? appHostingConfig.storageBucket,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? appHostingConfig.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? appHostingConfig.appId,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NEXT_PUBLIC_USE_FIREBASE_EMULATOR: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR ?? "false",
  },
};

export default nextConfig;
