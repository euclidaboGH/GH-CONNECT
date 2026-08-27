// PWA Initialization and Service Worker Management

export interface PwaConfig {
  enabled: boolean
  swPath: string
  updateCheckInterval: number
}

let deferredPrompt: any = null
let isOnline = navigator.onLine

const config: PwaConfig = {
  enabled: typeof window !== 'undefined' && 'serviceWorker' in navigator,
  swPath: '/sw.js',
  updateCheckInterval: 60 * 60 * 1000, // 1 hour
}

export const pwaManager = {
  /**
   * Initialize PWA features
   */
  async init() {
    if (!config.enabled) {
      console.warn('[PWA] Service workers not supported')
      return
    }

    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register(config.swPath, {
        scope: '/',
        updateViaCache: 'none',
      })

      console.log('[PWA] Service worker registered:', reg.scope)

      // Check for updates every hour
      setInterval(() => {
        reg.update().catch((err) => {
          console.warn('[PWA] Update check failed:', err)
        })
      }, config.updateCheckInterval)

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated')
        // Optionally notify user about update
        window.dispatchEvent(new CustomEvent('pwa-updated'))
      })
    } catch (err) {
      console.error('[PWA] Registration failed:', err)
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt = e
      console.log('[PWA] Install prompt available')
      window.dispatchEvent(new CustomEvent('pwa-installable'))
    })

    // Track online/offline
    window.addEventListener('online', () => {
      isOnline = true
      console.log('[PWA] Back online')
      window.dispatchEvent(new CustomEvent('pwa-online'))
    })

    window.addEventListener('offline', () => {
      isOnline = false
      console.log('[PWA] Going offline')
      window.dispatchEvent(new CustomEvent('pwa-offline'))
    })

    // Track app install
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed')
      deferredPrompt = null
      window.dispatchEvent(new CustomEvent('pwa-installed'))
    })
  },

  /**
   * Prompt user to install app
   */
  async promptInstall() {
    if (!deferredPrompt) {
      console.warn('[PWA] Install prompt not available')
      return false
    }

    try {
      deferredPrompt.prompt()
      const choiceResult = await deferredPrompt.userChoice

      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted install')
        return true
      } else {
        console.log('[PWA] User dismissed install')
        return false
      }
    } catch (err) {
      console.error('[PWA] Install prompt failed:', err)
      return false
    }
  },

  /**
   * Check if PWA is installed
   */
  isInstalled() {
    // Check if running as PWA
    return window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
  },

  /**
   * Get online status
   */
  getOnlineStatus() {
    return isOnline
  },

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      console.warn('[PWA] Notifications not supported')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
      } catch (err) {
        console.error('[PWA] Notification permission request failed:', err)
        return false
      }
    }

    return false
  },

  /**
   * Send notification
   */
  async sendNotification(title: string, options: NotificationOptions = {}) {
    try {
      if (Notification.permission !== 'granted') {
        return false
      }

      // Use service worker to show notification
      const reg = await navigator.serviceWorker.ready
      reg.showNotification(title, {
        icon: '/icon-dark-32x32.png',
        badge: '/icon-light-32x32.png',
        ...options,
      })

      return true
    } catch (err) {
      console.error('[PWA] Failed to send notification:', err)
      return false
    }
  },

  /**
   * Request periodic background sync
   */
  async enableBackgroundSync(tag: string = 'sync-messages', minInterval: number = 24 * 60 * 60 * 1000) {
    try {
      const reg = await navigator.serviceWorker.ready

      if ('periodicSync' in reg) {
        try {
          await (reg as any).periodicSync.register(tag, {
            minInterval,
          })
          console.log('[PWA] Periodic sync registered:', tag)
          return true
        } catch (err) {
          console.warn('[PWA] Periodic sync registration failed:', err)
          return false
        }
      }

      console.warn('[PWA] Periodic sync not supported')
      return false
    } catch (err) {
      console.error('[PWA] Background sync error:', err)
      return false
    }
  },

  /**
   * Get cached size
   */
  async getCacheSize() {
    try {
      const storage = await (navigator as any).storage?.estimate?.()
      if (storage) {
        return {
          usage: storage.usage,
          quota: storage.quota,
          percentage: (storage.usage / storage.quota) * 100,
        }
      }
      return null
    } catch (err) {
      console.error('[PWA] Cache size estimation failed:', err)
      return null
    }
  },

  /**
   * Clear cache
   */
  async clearCache() {
    try {
      const cacheNames = await caches.keys()
      const cleared = await Promise.all(
        cacheNames.map((name) => caches.delete(name))
      )
      console.log('[PWA] Cache cleared:', cleared.length, 'caches')
      return true
    } catch (err) {
      console.error('[PWA] Cache clear failed:', err)
      return false
    }
  },
}

export const usePwaInstall = () => {
  const [canInstall, setCanInstall] = React.useState(false)

  React.useEffect(() => {
    const handleInstallable = () => setCanInstall(true)
    const handleInstalled = () => setCanInstall(false)

    window.addEventListener('pwa-installable', handleInstallable)
    window.addEventListener('pwa-installed', handleInstalled)

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable)
      window.removeEventListener('pwa-installed', handleInstalled)
    }
  }, [])

  return { canInstall, promptInstall: pwaManager.promptInstall }
}

export const usePwaStatus = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine)

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('pwa-online', handleOnline)
    window.addEventListener('pwa-offline', handleOffline)

    return () => {
      window.removeEventListener('pwa-online', handleOnline)
      window.removeEventListener('pwa-offline', handleOffline)
    }
  }, [])

  return {
    isOnline,
    isInstalled: pwaManager.isInstalled(),
    hasNotificationSupport: 'Notification' in window,
    hasBackgroundSyncSupport: 'periodicSync' in (navigator.serviceWorker?.controller || {}),
  }
}
