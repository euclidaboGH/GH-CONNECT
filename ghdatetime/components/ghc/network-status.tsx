"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff } from "lucide-react"

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-destructive text-white px-4 py-2 flex items-center justify-center gap-2">
      <WifiOff size={16} />
      <span className="text-sm font-medium">No internet connection</span>
    </div>
  )
}
