export interface PurchaseResult {
  ok: true;
  productId: string;
  paymentId: string;
  txid: string;
}

export interface SDKLiteError extends Error {
  name: "SDKLiteError";
  code: "product_not_found" | "purchase_cancelled" | "purchase_error";
}

/**
 * Writable payload for Pi/local user-state persistence.
 *
 * Runtime: JSON.stringify → storage (same format as before).
 * Type: `object` accepts concrete domain values (Profile, Settings, Post[],
 * string[], etc.) without requiring an index signature.
 * Read path remains UserStateRecord.blob as Record<string, unknown> and is
 * validated via helpers such as coerceStoredProfile().
 */
export type UserStateWritable = object

export interface UserStateRecord {
  blob: Record<string, unknown>;
  updatedAt: string;
  version: number;
}

export interface UserPurchaseBalance {
  productId: string;
  quantity: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price_in_pi: number;
  total_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductsResponse {
  products: Product[];
}

export interface PurchasesResponse {
  purchases: UserPurchaseBalance[];
}

export interface ConsumeResponse {
  productId: string;
  quantity: number;
}

export interface RestoreOptions {
  keys?: string[];
}

export interface SDKLiteState {
  get: (key: string) => Promise<UserStateRecord | null>;
  set: (key: string, blob: UserStateWritable) => Promise<void>;
  products: () => Promise<ProductsResponse>;
  purchases: () => Promise<PurchasesResponse>;
  consume: (productId: string, quantity?: number) => Promise<ConsumeResponse>;
  restore: (options?: RestoreOptions) => Promise<PurchasesResponse>;
}

export interface SDKLiteInstance {
  login: () => Promise<boolean>;
  makePurchase: (productId: string) => Promise<PurchaseResult>;
  showInterstitial: () => Promise<boolean>;
  showRewarded: (productId: string) => Promise<boolean>;
  isAdNetworkSupported: () => Promise<boolean>;
  state: SDKLiteState;
}

declare global {
  interface Window {
    SDKLite: {
      init: () => Promise<SDKLiteInstance>;
    };
    Pi: {
      init: (config: { version: string; sandbox?: boolean }) => Promise<void>;
    };
  }
}
