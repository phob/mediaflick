import type { Metadata } from "next"

import "@/app/globals.css"
import HeadBar from "@/components/head-bar/head-bar"
import { Providers } from "@/app/providers"
import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { clsx } from "clsx";
export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: "%s | " + siteConfig.name,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({children,}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" className="dark">
      <body className={clsx(
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable,
        )}>
        <Providers>
          <div className="sticky top-0 z-50">
            <HeadBar />
          </div>
          <main className="min-h-[calc(100vh-4rem)] px-4">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
