"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { PiAuthProvider, usePiAuth } from "@/contexts/pi-auth-context";
import { IdentityProvider } from "@/contexts/identity-context";
import { SessionLockProvider } from "@/contexts/session-lock-context"
import { RegionalContextProvider } from "@/contexts/regional-context";
import { SessionLockGate } from "@/components/ghc/session-lock-screen";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { ErrorBoundary } from "@/lib/error-boundary";
import { a11y } from "@/lib/accessibility";
import { offlineSupport } from "@/lib/offline";
import "@/lib/auth/install-api-auth-fetch";

/**
 * Public routes that must render without Pi sign-in (Pi Portal listing,
 * domain claim, legal compliance). Do not expand this list to app shell tabs.
 */
const PUBLIC_PATH_PREFIXES = [
  "/privacy",
  "/terms",
  "/support",
  "/portal-setup",
  "/validation-key.txt",
] as const;

function isPublicPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || "";
  if (path === "/" || path === "") return false;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

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
  const [connectionState, setConnectionState] = useState<"online" | "offline" | "restored">("online");
  const wasOffline = useRef(false);

  useEffect(() => {
    let restoredTimer: ReturnType<typeof setTimeout> | undefined;
    const onOnline = () => {
      if (wasOffline.current) {
        wasOffline.current = false;
        setConnectionState("restored");
        a11y.announce("Connection restored. Check any pending actions before retrying.", "assertive");
      } else {
        setConnectionState("online");
      }
      if (restoredTimer) clearTimeout(restoredTimer);
      restoredTimer = setTimeout(() => setConnectionState("online"), 3200);
    };
    const onOffline = () => {
      if (restoredTimer) clearTimeout(restoredTimer);
      wasOffline.current = true;
      setConnectionState("offline");
      a11y.announce("You are offline. Live updates and new actions may be unavailable.", "assertive");
    };

    if (!offlineSupport.isOnline()) {
      wasOffline.current = true;
      setConnectionState("offline");
    }
    const unsubscribe = offlineSupport.setupListeners(onOnline, onOffline);
    return () => {
      unsubscribe();
      if (restoredTimer) clearTimeout(restoredTimer);
    };
  }, []);

  if (connectionState === "online") return null;
  const isOffline = connectionState === "offline";
  return (
    <div
      role={isOffline ? "alert" : "status"}
      aria-live={isOffline ? "assertive" : "polite"}
      className={`fixed inset-x-0 top-0 z-[120] flex justify-center px-3 pt-[max(.5rem,env(safe-area-inset-top))] pointer-events-none`}
    >
      <div className={`pointer-events-auto flex w-full max-w-xl items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-xl ${isOffline ? "border-amber-500/30 bg-amber-950/95 text-amber-50" : "border-emerald-500/30 bg-emerald-950/95 text-emerald-50"}`}>
        {isOffline ? <WifiOff size={17} aria-hidden="true" /> : <Wifi size={17} aria-hidden="true" />}
        <span className="min-w-0 flex-1">{isOffline ? "You’re offline. Live updates and new actions may be unavailable." : "Connection restored. Check pending actions before retrying."}</span>
      </div>
    </div>
  );
}

function AppContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = usePiAuth();

  // Legal / portal pages must be crawlable and open without Pi auth.
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  if (!isAuthenticated) return <AuthLoadingScreen />;
  return <SessionLockGate>{children}</SessionLockGate>;
}

export function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <PiAuthProvider>
        <IdentityProvider>
          <SessionLockProvider>
            <RegionalContextProvider>
            <AccessibilitySetup />
            <OfflineListener />
            <AppContent>{children}</AppContent>
            </RegionalContextProvider>
          </SessionLockProvider>
        </IdentityProvider>
      </PiAuthProvider>
    </ErrorBoundary>
  );
}
