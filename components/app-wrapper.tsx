"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { IdentityProvider } from "@/contexts/identity-context";
import { SessionLockProvider } from "@/contexts/session-lock-context";
import { SessionLockGate } from "@/components/ghc/session-lock-screen";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { ErrorBoundary } from "@/lib/error-boundary";
import { a11y } from "@/lib/accessibility";
import { offlineSupport } from "@/lib/offline";

function AccessibilitySetup() {
  useEffect(() => {
    a11y.addSkipLink();

    if (typeof document !== "undefined") {
      if (!document.getElementById("aria-live-region")) {
        const liveRegion = document.createElement("div");
        liveRegion.id = "aria-live-region";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.className = "sr-only";
        liveRegion.style.position = "absolute";
        liveRegion.style.width = "1px";
        liveRegion.style.height = "1px";
        liveRegion.style.overflow = "hidden";
        document.body.appendChild(liveRegion);
      }
    }
  }, []);

  return null;
}

function OfflineListener() {
  useEffect(() => {
    const unsubscribe = offlineSupport.setupListeners(
      () => {
        a11y.announce("Connection restored. Syncing data...", "assertive");
      },
      () => {
        a11y.announce("No internet connection. Some features may be limited.", "assertive");
      }
    );

    return unsubscribe;
  }, []);

  return null;
}

function AppContent({ children }: { children: ReactNode }) {
  const { isAuthenticated } = usePiAuth();
  if (!isAuthenticated) return <AuthLoadingScreen />;
  return <SessionLockGate>{children}</SessionLockGate>;
}

export function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <PiAuthProvider>
        <IdentityProvider>
          <SessionLockProvider>
            <AccessibilitySetup />
            <OfflineListener />
            <AppContent>{children}</AppContent>
          </SessionLockProvider>
        </IdentityProvider>
      </PiAuthProvider>
    </ErrorBoundary>
  );
}
