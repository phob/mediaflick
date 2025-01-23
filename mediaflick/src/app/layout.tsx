import type { Metadata } from "next"
import { clsx } from "clsx"
import { type ReactNode } from "react"
import "@/app/globals.css"
import HeadBar from "@/components/head-bar/head-bar"
import { fontSans } from "@/config/fonts"
import { siteConfig } from "@/config/site"
import { ThemeProvider } from "@/components/theme-provider"

interface RootLayoutProps {
  children: ReactNode
}

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={clsx("min-h-screen bg-background font-sans antialiased", fontSans.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <div className="fixed left-0 right-0 top-0 z-[100]">
            <div className="mx-auto">
              <div className="backdrop-blur-md motion-translate-y-in-[-100%] motion-blur-in-md motion-opacity-in-0">
                <HeadBar />
              </div>
            </div>
          </div>
          <main className="relative min-h-screen pt-16">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
