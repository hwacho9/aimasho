"use client";

import { useEffect } from "react";
import { initializeAnalytics } from "@/lib/firebase/client";

/** Starts Firebase Analytics once per browser session when it is configured. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initializeAnalytics();
  }, []);

  return children;
}
