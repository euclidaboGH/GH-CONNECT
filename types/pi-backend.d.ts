declare module "pi-backend" {
  export type PiBackendPayment = {
    identifier?: string; user_uid?: string; amount?: number | string; memo?: string;
    metadata?: Record<string, unknown>; direction?: "user_to_app" | "app_to_user"; network?: string;
    status?: { developer_approved?: boolean; transaction_verified?: boolean; developer_completed?: boolean; cancelled?: boolean; user_cancelled?: boolean };
    transaction?: null | { txid?: string; verified?: boolean; _link?: string };
    [key: string]: unknown;
  };
  export default class PiNetwork {
    constructor(apiKey: string, walletPrivateSeed: string);
    createPayment(args: { amount: number; memo: string; metadata: Record<string, unknown>; uid: string }): Promise<string>;
    submitPayment(paymentId: string): Promise<string>;
    completePayment(paymentId: string, txid: string): Promise<PiBackendPayment>;
    getPayment(paymentId: string): Promise<PiBackendPayment>;
    getIncompleteServerPayments(): Promise<PiBackendPayment[]>;
    cancelPayment(paymentId: string): Promise<PiBackendPayment>;
  }
}
