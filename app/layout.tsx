import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AppWrapper } from "@/components/app-wrapper"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "GreenHaven",
    template: "%s · GreenHaven",
  },
  description:
    "GreenHaven — global social, matching, community and GHC utility platform on Pi Network",
  applicationName: "GreenHaven",
  authors: [{ name: "GreenHaven" }],
  generator: "GreenHaven",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-light-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "GreenHaven",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "GreenHaven",
    title: "GreenHaven",
    description:
      "Connect worldwide for friendships, dating, networking, and meaningful relationships on Pi Network",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://sdk.minepi.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://sdk.minepi.com" />
        <link rel="preconnect" href="https://api.minepi.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.minepi.com" />
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="bg-background antialiased">
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  )
}
