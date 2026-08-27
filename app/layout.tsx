import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AppWrapper } from "@/components/app-wrapper"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "GH Connect",
    template: "%s · GH Connect",
  },
  description:
    "GH Connect — global social, matching, community and GHC utility platform on Pi Network",
  applicationName: "GH Connect",
  authors: [{ name: "GH Connect" }],
  generator: "GH Connect",
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
    title: "GH Connect",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "GH Connect",
    title: "GH Connect",
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
