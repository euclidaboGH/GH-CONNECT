"use client"

import { GHCProvider } from "@/contexts/ghc-context"
import { IdentityProvider } from "@/contexts/identity-context"
import { FeedProvider } from "@/contexts/domains/feed-provider"
import { WalletReadProvider } from "@/contexts/domains/wallet-read-provider"
import { ConnectionsProvider } from "@/contexts/domains/connections-provider"
import { DiscoveryProvider } from "@/contexts/domains/discovery-provider"
import { MessagingProvider } from "@/contexts/domains/messaging-provider"
import { NotificationsProvider } from "@/contexts/domains/notifications-provider"
import { GHConnectApp } from "@/components/ghc/app"

/**
 * Provider hierarchy (Steps 50.1 + 4):
 * Identity → Connections → Discovery → Feed → WalletRead → GHC facade
 * Financial WRITE authority remains inside economy domain / GHCProvider only.
 */
export default function HomePage() {
  return (
    <IdentityProvider>
      <ConnectionsProvider>
        <DiscoveryProvider>
          <FeedProvider>
            <WalletReadProvider>
              <GHCProvider>
                <MessagingProvider>
                  <NotificationsProvider>
                    <GHConnectApp />
                  </NotificationsProvider>
                </MessagingProvider>
              </GHCProvider>
            </WalletReadProvider>
          </FeedProvider>
        </DiscoveryProvider>
      </ConnectionsProvider>
    </IdentityProvider>
  )
}
