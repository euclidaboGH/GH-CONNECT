"use client"

export type ConfirmDialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export type PromptDialogOptions = {
  title: string
  message?: string
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  cancelLabel?: string
  inputType?: "text" | "password"
  maxLength?: number
  pattern?: string
}

type Resolver<T> = (value: T) => void

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false)
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("ghc:confirm-dialog", { detail: { ...options, resolve } }))
  })
}

export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("ghc:prompt-dialog", { detail: { ...options, resolve } }))
  })
}

export type GlobalInteractionRequest =
  | ({ kind: "confirm"; resolve: Resolver<boolean> } & ConfirmDialogOptions)
  | ({ kind: "prompt"; resolve: Resolver<string | null> } & PromptDialogOptions)
