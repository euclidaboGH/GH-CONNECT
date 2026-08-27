"use client"

import { GHCProvider } from "@/contexts/ghc-context"
import { GHConnectApp } from "@/components/ghc/app"

export default function HomePage() {
  return (
    <GHCProvider>
      <GHConnectApp />
    </GHCProvider>
  )
}
