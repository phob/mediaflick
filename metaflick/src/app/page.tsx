import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen dark:bg-black/65 dark:text-white">
      <main className="flex flex-col items-center justify-center text-center max-w-5xl mx-auto h-dvh">
        <div className="flex flex-col gap-6 p-12 rounded-lg border border-gray-200 dark:border-gray-800 bg-background/80 backdrop-blur-sm">
          <h1 className="h-7 w-48 relative"><Logo /></h1>
        </div>
      </main>
    </div>
  );
}
