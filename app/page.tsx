"use client"

import { GHCProvider } from "@/contexts/ghc-context"
import { FeedProvider } from "@/contexts/domains/feed-provider"
import { WalletReadProvider } from "@/contexts/domains/wallet-read-provider"
import { ConnectionsProvider } from "@/contexts/domains/connections-provider"
import { DiscoveryProvider } from "@/contexts/domains/discovery-provider"
import { MessagingProvider } from "@/contexts/domains/messaging-provider"
import { NotificationsProvider } from "@/contexts/domains/notifications-provider"
import { GHConnectApp } from "@/components/ghc/app"

/**
 * Domain provider hierarchy:
 * Connections → Discovery → Feed → WalletRead → GHC facade → Messaging → Notifications.
 * IdentityProvider is mounted once in AppWrapper above SessionLockGate and this tree,
 * so the lock gate and all domain screens observe the same identity context.
 * Financial WRITE authority remains inside economy domain / GHCProvider only.
 */
export default function HomePage() {
  return (
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
  )
}
