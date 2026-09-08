"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { PI_NETWORK_CONFIG, allowLocalAuthFallback } from "@/lib/system-config"
import { onIncompletePaymentFound } from "@/lib/pi-incomplete-payment";
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


/** Best-effort Pi Browser detection (UA + bridge). */
function detectPiEnvironment(): {
  hasWindowPi: boolean
  uaLooksLikePi: boolean
  userAgent: string
} {
  if (typeof window === "undefined") {
    return { hasWindowPi: false, uaLooksLikePi: false, userAgent: "" }
  }
  const ua = String(window.navigator?.userAgent || "")
  const uaLooksLikePi =
    /PiBrowser/i.test(ua) ||
    /Pi Network/i.test(ua) ||
    /minepi/i.test(ua) ||
    /Pi/i.test(ua)
  return {
    hasWindowPi: typeof (window as any).Pi !== "undefined",
    uaLooksLikePi,
    userAgent: ua.slice(0, 160),
  }
}

/**
 * Pi Browser often injects window.Pi slightly after first paint.
 * Poll briefly before treating the bridge as missing.
 */
async function waitForWindowPi(timeoutMs = 10000, intervalMs = 250): Promise<boolean> {
  if (typeof window === "undefined") return false
  if (typeof (window as any).Pi !== "undefined") return true
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs))
    if (typeof (window as any).Pi !== "undefined") return true
  }
  return typeof (window as any).Pi !== "undefined"
}

const loadPiSDK = async (): Promise<void> => {

  if (typeof window === "undefined") {
    throw new Error("Pi Browser required (no window)")
  }
  // Prefer native bridge (injected by Pi Browser)
  if (typeof (window as any).Pi !== "undefined") return

  const env = detectPiEnvironment()
  console.info("[PiAuth] waiting for window.Pi", env)

  const appeared = await waitForWindowPi(10000, 250)
  if (appeared) {
    console.info("[PiAuth] window.Pi appeared after wait")
    return
  }

  // Optional CDN load — only helps when host already provides Pi host APIs
  try {
    const timeout = PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000
    await loadScript(PI_NETWORK_CONFIG.SDK_URL, timeout)
  } catch (e) {
    console.warn("[PiAuth] CDN Pi SDK load issue:", e)
  }

  if (await waitForWindowPi(3000, 250)) return

  const after = detectPiEnvironment()
  console.warn("[PiAuth] window.Pi still missing", after)
  throw new Error(
    after.uaLooksLikePi
      ? "Pi Browser detected but window.Pi is still missing. Wait a few seconds and Retry, or re-open the app from Pi → Develop using the exact URL registered in the Developer Portal. Check NEXT_PUBLIC_PI_SANDBOX matches sandbox/testnet."
      : "Pi bridge (window.Pi) not found. Open GreenHaven from inside the Pi app (Develop → your app). Pasting the Vercel URL into Chrome/WhatsApp will not work."
  )
}

/** Map raw SDK ReferenceErrors to a clear operator message */
function humanizePiAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || "Authentication failed")
  if (/Pi is not defined/i.test(raw) || /window\.Pi/i.test(raw) || /bridge not found/i.test(raw) || /still missing/i.test(raw)) {
    const env = typeof window !== "undefined" ? detectPiEnvironment() : null
    if (env?.uaLooksLikePi) {
      return "Almost there: Pi Browser is open, but the Pi bridge has not loaded yet. Tap Retry authentication. If it keeps failing, re-open from Pi → Develop with the registered app URL and confirm NEXT_PUBLIC_PI_SANDBOX=true for sandbox."
    }
    return "Pi Browser bridge not available. Open the Pi app → Develop → GreenHaven (do not use Chrome or WhatsApp). If you are already in Pi Browser, tap Retry."
  }
  return raw
}



/**
 * Official Pi auth path (docs):
 * 1) script tag loads window.Pi
 * 2) Pi.init({ version: "2.0", sandbox })
 * 3) Pi.authenticate(["username","payments"], onIncompletePaymentFound)
 * Backend must verify accessToken via Platform API GET /me — never trust client uid alone.
 */
async function officialPiAuthenticate(): Promise<{
  uid: string
  username: string | null
  accessToken: string | null
}> {
  if (typeof window === "undefined") {
    throw new Error("No window")
  }

  // Ensure SDK global
  if (typeof (window as any).Pi === "undefined") {
    await waitForWindowPi(12000, 200)
  }
  if (typeof (window as any).Pi === "undefined") {
    try {
      await loadScript(PI_NETWORK_CONFIG.SDK_URL, PI_NETWORK_CONFIG.SCRIPT_LOAD_TIMEOUT_MS || 12000)
      await waitForWindowPi(5000, 200)
    } catch {
      /* continue to final check */
    }
  }
  const Pi = (window as any).Pi
  if (!Pi) {
    throw new Error(
      "Pi SDK (window.Pi) is not available. Confirm pi-sdk.js loaded and open the app from Pi Browser / Sandbox."
    )
  }

  if (typeof Pi.init === "function") {
    await Pi.init({
      version: "2.0",
      sandbox: Boolean(PI_NETWORK_CONFIG.SANDBOX),
    })
  }

  if (typeof Pi.authenticate !== "function") {
    throw new Error("Pi.authenticate is not available on this host")
  }

  const authResult = await Pi.authenticate(
    ["username", "payments"],
    (payment: unknown) => {
      void onIncompletePaymentFound(
        payment as {
          identifier?: string
          paymentId?: string
          transaction?: { txid?: string } | null
        }
      )
    }
  )

  const resolvedUid = authResult?.user?.uid != null ? String(authResult.user.uid) : ""
  if (!resolvedUid) {
    throw new Error("Pi authentication did not return a user id")
  }
  const username = authResult?.user?.username ? String(authResult.user.username) : null
  const accessToken = authResult?.accessToken ? String(authResult.accessToken) : null

  return {
    uid: resolvedUid,
    username,
    accessToken,
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
        setAuthMessage("Authenticating with Pi...");
        const identity = await officialPiAuthenticate();

        // Strict compliance: never treat client uid as final.
        // Verify accessToken with Platform GET /me via our backend, then map to GH identity.
        let serverVerified = false
        let needsOnboarding = true
        let isReturning = false
        let ghUserId = identity.uid
        let verifiedUsername = identity.username

        if (identity.accessToken) {
          try {
            setAuthMessage("Verifying Pi identity with server...");
            const bridgeRes = await fetch("/api/auth/pi", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ accessToken: identity.accessToken }),
            })
            const bridge = await bridgeRes.json().catch(() => ({}))
            if (bridgeRes.ok && bridge?.ok && bridge?.identity?.piAppUid) {
              serverVerified = true
              ghUserId = String(bridge.identity.ghUserId || bridge.identity.piAppUid)
              verifiedUsername =
                bridge.identity.piUsername != null
                  ? String(bridge.identity.piUsername)
                  : identity.username
              needsOnboarding = Boolean(bridge.needsOnboarding)
              isReturning = Boolean(bridge.isReturning)
              if (bridge.durabilityWarning) {
                console.warn(
                  "[PiAuth] identity/session not durable on this deployment:",
                  bridge.durabilityWarning,
                  {
                    durable: bridge.durable,
                    sessionDurable: bridge.sessionDurable,
                  }
                )
              }
            } else {
              console.warn("[PiAuth] /api/auth/pi did not verify:", bridge)
            }
          } catch (bridgeErr) {
            console.warn("[PiAuth] identity bridge network error:", bridgeErr)
          }
        }

        IdentityService.setFromPi({
          uid: ghUserId,
          username: verifiedUsername,
          displayName: verifiedUsername,
          accessToken: identity.accessToken,
          verifiedByServer: serverVerified,
          needsOnboarding: serverVerified ? needsOnboarding : true,
        });
        try {
          window.dispatchEvent(
            new CustomEvent("ghc:pi-identity-ready", {
              detail: {
                uid: ghUserId,
                username: verifiedUsername,
                accessToken: identity.accessToken,
                serverVerified,
                needsOnboarding,
                isReturning,
              },
            })
          );
        } catch { /* */ }

        // Official path success — try SDKLite for optional commerce features, non-blocking
        try {
          setAuthMessage("Loading optional commerce SDK...");
          await loadSDKLite();
          const sdkLite = await (window as any).SDKLite.init();
          let sdkInstance: SDKLiteInstance;
          try {
            const pi = buildPiSdk();
            await pi.auth.login();
            await sdkLite.login();
            sdkInstance = createSdk(sdkLite, pi);
          } catch {
            sdkInstance = sdkLite;
          }
          setSdk(sdkInstance);
          await fetchProducts(sdkInstance);
          try {
            const { purchases } = await sdkInstance.state.restore();
            setRestoredPurchases(purchases);
          } catch {
            setRestoredPurchases([]);
          }
        } catch (optionalErr) {
          console.warn("[PiAuth] SDKLite optional path skipped:", optionalErr);
          // Minimal sdk stub so consumers expecting sdk don't crash
          setSdk(createLocalSdkLite(identity.uid));
          setProducts([]);
          setRestoredPurchases([]);
        }

        setIsAuthenticated(true);
        setAuthMessage("Signed in with Pi");
        return;
      } catch (piErr) {
        console.warn("[PiAuth] Official Pi auth failed:", piErr);
        if (!allowLocalAuthFallback()) {
          throw piErr instanceof Error
            ? piErr
            : new Error(humanizePiAuthError(piErr));
        }
        // Fall through to local / SDKLite only when allowed
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

        // 3) Local fallback — Studio / localhost only (never Vercel production)
        if (allowLocalAuthFallback()) {
          setAuthMessage("Using local preview session...");
          const localSdk = createLocalSdkLite("preview-user");
          setSdk(localSdk);
          setIsAuthenticated(true);
          setProducts([]);
          setRestoredPurchases([]);
          IdentityService.setFromPi({ uid: null, username: "preview" });
          IdentityService.setAuthState("authenticated");
          console.info(
            "[PiAuth] Local auth fallback active — remote SDKLite unavailable."
          );
          return;
        }
        setAuthMessage(
          "Could not load Pi authentication. Open GreenHaven inside the Pi Browser and try again."
        );

        throw sdkLiteErr instanceof Error
          ? sdkLiteErr
          : new Error("Failed to load SDKLite script");
      }
    } catch (err) {
      console.error("SDKLite initialization failed:", err);
      setHasError(true);
      setAuthMessage(humanizePiAuthError(err));
    }
  };

  const continueLocalPreview = () => {
    if (!allowLocalAuthFallback()) {
      setHasError(true);
      setAuthMessage(
        "Local preview is disabled on this host. Open GreenHaven in the Pi Browser and sign in with your Pi account."
      );
      return;
    }
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
      setIsAuthenticated((prev) => {
        if (prev) return prev;
        // Production / Pi-required hosts: show error, do NOT fake a user
        if (!allowLocalAuthFallback()) {
          setHasError(true);
          setAuthMessage(
            "Pi Browser is required. Open this GreenHaven link inside the Pi app (Develop → your app, or the production URL). Sign in with your Pi account to continue."
          );
          return false;
        }
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
