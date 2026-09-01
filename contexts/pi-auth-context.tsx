"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { PI_NETWORK_CONFIG } from "@/lib/system-config";
import { IdentityService } from "@/lib/identity/identity-service";
import { buildPiSdk, createSdk } from "@/lib/pi";
import { createLocalSdkLite, isLikelyAppStudioPreview } from "@/lib/local-pi-sdk";
import type {
  Product,
  SDKLiteInstance,
  UserPurchaseBalance,
} from "@/lib/sdklite-types";

const COMMUNICATION_REQUEST_TYPE = '@pi:app:sdk:communication_information_request';

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin / Permission denied — treat as iframe, never crash auth
    return true;
  }
}

function parseJsonSafely(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  return typeof value === 'object' && value !== null ? value : null;
}

/**
 * Requests authentication credentials from the parent window (App Studio) via postMessage.
 * Returns null if not in iframe, timeout, or missing token (non-fatal check).
 *
 * @returns {Promise<{accessToken: string, appId: string}|null>} Resolves with credentials or null
 */
function requestParentCredentials(): Promise<{ accessToken: string; appId: string | null } | null> {
  // Early return if not in an iframe
  if (!isInIframe()) {
    return Promise.resolve(null);
  }

  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const timeoutMs = PI_NETWORK_CONFIG.PARENT_CREDENTIAL_TIMEOUT_MS || 4000;

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Cleanup function to remove listener and clear timeout
    const cleanup = (listener: (event: MessageEvent) => void) => {
      window.removeEventListener('message', listener);
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };

    const messageListener = (event: MessageEvent) => {
      // Security: only accept messages from parent window
      if (event.source !== window.parent) {
        return;
      }

      // Validate message type and request ID match
      const data = parseJsonSafely(event.data);
      if (!data || data.type !== COMMUNICATION_REQUEST_TYPE || data.id !== requestId) {
        return;
      }

      cleanup(messageListener);

      // Extract credentials from response payload
      const payload = typeof data.payload === 'object' && data.payload !== null ? data.payload : {};
      const accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : null;
      const appId = typeof payload.appId === 'string' ? payload.appId : null;

      // Return credentials or null if missing token
      resolve(accessToken ? { accessToken, appId } : null);
    };

    // Set timeout handler (resolve with null on timeout)
    timeoutId = setTimeout(() => {
      cleanup(messageListener);
      resolve(null);
    }, timeoutMs);

    // Register listener before sending request to avoid race condition
    window.addEventListener('message', messageListener);

    // Send request to parent window to get credentials
    window.parent.postMessage(
      JSON.stringify({
        type: COMMUNICATION_REQUEST_TYPE,
        id: requestId
      }),
      '*'
    );
  });
}

interface PiAuthContextType {
  isAuthenticated: boolean;
  authMessage: string;
  hasError: boolean;
  sdk: SDKLiteInstance | null;
  products: Product[] | null;
  restoredPurchases: UserPurchaseBalance[] | null;
  reinitialize: () => Promise<void>;
  /** Open a local session when Pi SDK is unavailable (Vercel / desktop browser) */
  continueLocalPreview: () => void;
}

const PiAuthContext = createContext<PiAuthContextType | undefined>(undefined);

function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already present?
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing && (src.includes("pi-sdk") ? typeof (window as any).Pi !== "undefined" : typeof (window as any).SDKLite !== "undefined")) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.crossOrigin = "anonymous"

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      script.remove()
      reject(new Error(`Timed out loading script: ${src}`))
    }, timeoutMs)

    script.onload = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve()
    }
    script.onerror = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      script.remove()
      reject(new Error(`Failed to load script: ${src}`))
    }

    document.head.appendChild(script)
  })
}

const loadPiSDK = async (): Promise<void> => {
  if (typeof window !== "undefined" && typeof (window as any).Pi !== "undefined") return
  const timeout = PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000
  await loadScript(PI_NETWORK_CONFIG.SDK_URL, timeout)
  if (typeof (window as any).Pi === "undefined") {
    throw new Error("Pi SDK loaded but window.Pi is undefined")
  }
}

const loadSDKLite = async (): Promise<void> => {
  if (typeof window !== "undefined" && typeof (window as any).SDKLite !== "undefined") return

  const timeout = PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000
  const urls = [
    PI_NETWORK_CONFIG.SDK_LITE_URL,
    ...((PI_NETWORK_CONFIG as any).SDK_LITE_URL_FALLBACKS || []),
  ].filter(Boolean) as string[]

  let lastError: Error | null = null
  for (const url of urls) {
    try {
      await loadScript(url, timeout)
      if (typeof (window as any).SDKLite !== "undefined") {
        console.log("[PiAuth] SDKLite loaded from", url)
        return
      }
      lastError = new Error(`Script loaded but SDKLite global missing: ${url}`)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      console.warn("[PiAuth] SDKLite candidate failed:", url, lastError.message)
    }
  }
  throw lastError || new Error("Failed to load SDKLite script")
}

export function PiAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMessage, setAuthMessage] = useState("Initializing Pi Network...");
  const [hasError, setHasError] = useState(false);
  const [sdk, setSdk] = useState<SDKLiteInstance | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [restoredPurchases, setRestoredPurchases] = useState<
    UserPurchaseBalance[] | null
  >(null);

  const fetchProducts = async (sdkInstance: SDKLiteInstance): Promise<void> => {
    try {
      const { products } = await sdkInstance.state.products();
      setProducts(products);
    } catch (e) {
      console.error("Failed to load products:", e);
      setProducts([]);
    }
  };

  const initialize = async () => {
    setHasError(false);
    setRestoredPurchases(null);
    try {
      // 1) App Studio parent credentials (iframe)
      setAuthMessage("Connecting to Pi Network...");
      const parentCredentials = await requestParentCredentials();
      if (parentCredentials?.accessToken) {
        setAuthMessage("Authenticated via App Studio...");
        // Provide local state SDK so profile/onboarding can persist
        const localSdk = createLocalSdkLite(
          parentCredentials.appId || "app-studio-user"
        );
        setSdk(localSdk);
        setIsAuthenticated(true);
        setProducts([]);
        setRestoredPurchases([]);
        IdentityService.setFromPi({
          uid: parentCredentials.appId || null,
          accessToken: parentCredentials.accessToken,
          username: null,
        });
        return;
      }

      // 2) Official Pi SDK + SDKLite
      setAuthMessage("Loading Pi SDK...");
      try {
        await loadPiSDK();
        setAuthMessage("Initializing Pi Network...");
        if (typeof window.Pi?.init === "function") {
          await window.Pi.init({
            version: "2.0",
            sandbox: PI_NETWORK_CONFIG.SANDBOX,
          });
        }
      } catch (piErr) {
        console.warn("[PiAuth] Pi SDK load/init issue:", piErr);
        // Continue — SDKLite path or local fallback may still work
      }

      setAuthMessage("Loading SDKLite...");
      try {
        await loadSDKLite();
        setAuthMessage("Initializing SDKLite...");
        const sdkLite = await window.SDKLite.init();

        setAuthMessage("Signing in...");
        let sdkInstance: SDKLiteInstance;
        try {
          const pi = buildPiSdk();
          await pi.auth.login();
          const success = await sdkLite.login();
          if (!success) {
            throw new Error("Login failed. Please try again.");
          }
          const piUser = pi.auth.getUser?.() || null;
          sdkInstance = createSdk(sdkLite, pi);
          IdentityService.setFromPi({
            uid: piUser?.uid || null,
            username: piUser?.username || null,
            displayName: piUser?.username || null,
          });
        } catch (loginErr) {
          console.warn("[PiAuth] Hybrid login failed, using SDKLite only:", loginErr);
          const ok = await sdkLite.login();
          if (!ok) throw loginErr instanceof Error ? loginErr : new Error("Login failed");
          sdkInstance = sdkLite;
          // Best-effort: window.Pi current user
          try {
            const wPi = (window as unknown as { Pi?: { getUser?: () => { uid?: string; username?: string } | null } }).Pi;
            const u = wPi?.getUser?.() || null;
            if (u?.uid) {
              IdentityService.setFromPi({ uid: u.uid, username: u.username || null });
            }
          } catch { /* */ }
        }

        setSdk(sdkInstance);
        setIsAuthenticated(true);
        await fetchProducts(sdkInstance);

        try {
          const { purchases } = await sdkInstance.state.restore();
          setRestoredPurchases(purchases);
        } catch (e) {
          console.error("[PiAuth] Failed to restore purchases:", e);
          setRestoredPurchases([]);
        }
        return;
      } catch (sdkLiteErr) {
        console.error("[PiAuth] SDKLite path failed:", sdkLiteErr);

        // 3) Local fallback — App Studio preview / CDN blocked / offline
        const allowFallback = PI_NETWORK_CONFIG.ALLOW_LOCAL_AUTH_FALLBACK !== false;
        if (allowFallback && (isLikelyAppStudioPreview() || typeof window !== "undefined")) {
          setAuthMessage("Using local preview session...");
          const localSdk = createLocalSdkLite("preview-user");
          setSdk(localSdk);
          setIsAuthenticated(true);
          setProducts([]);
          setRestoredPurchases([]);
          IdentityService.setFromPi({ uid: null, username: "preview" });
          IdentityService.setAuthState("authenticated");
          console.info(
            "[PiAuth] Local auth fallback active — remote SDKLite unavailable. Onboarding will use local storage."
          );
          return;
        }

        throw sdkLiteErr instanceof Error
          ? sdkLiteErr
          : new Error("Failed to load SDKLite script");
      }
    } catch (err) {
      console.error("SDKLite initialization failed:", err);
      setHasError(true);
      setAuthMessage(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    }
  };

  const continueLocalPreview = () => {
    setHasError(false);
    setAuthMessage("Opening local preview session...");
    const localSdk = createLocalSdkLite(
      typeof window !== "undefined" && isLikelyAppStudioPreview()
        ? "app-studio-preview"
        : "local-preview-user"
    );
    setSdk(localSdk);
    setProducts([]);
    setRestoredPurchases([]);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    let cancelled = false;
    const hardTimeout = window.setTimeout(() => {
      if (cancelled) return;
      // Never leave users stuck on the spinner longer than ~20s
      setIsAuthenticated((prev) => {
        if (prev) return prev;
        console.info("[PiAuth] Auth hard-timeout — activating local preview session");
        const localSdk = createLocalSdkLite("timeout-preview-user");
        setSdk(localSdk);
        setProducts([]);
        setRestoredPurchases([]);
        setHasError(false);
        setAuthMessage("Local preview session ready");
        return true;
      });
    }, 20000);

    initialize().finally(() => {
      window.clearTimeout(hardTimeout);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(hardTimeout);
    };
  }, []);

  const value: PiAuthContextType = {
    isAuthenticated,
    authMessage,
    hasError,
    sdk,
    products,
    restoredPurchases,
    reinitialize: initialize,
    continueLocalPreview,
  };

  return (
    <PiAuthContext.Provider value={value}>{children}</PiAuthContext.Provider>
  );
}

export function usePiAuth() {
  const context = useContext(PiAuthContext);
  if (context === undefined) {
    throw new Error("usePiAuth must be used within a PiAuthProvider");
  }
  return context;
}
