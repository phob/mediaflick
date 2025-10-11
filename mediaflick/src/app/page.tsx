import { LogoModule } from "@/components/logo-module"
import { HeartbeatStatus } from "@/components/heartbeat-status"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <main className="mx-auto flex h-dvh max-w-5xl flex-col items-center justify-center text-center">
        <div className="flex flex-col gap-6 w-72 rounded-lg border border-border bg-background/80 p-12 backdrop-blur-sm motion-translate-y-in-[-100%] motion-opacity-in-0 motion-blur-in-md motion-delay-400">
          <div className="relative h-9 w-24">
            <LogoModule />
          </div>
          <HeartbeatStatus />
        </div>
      </main>
    </div>
  )
}
