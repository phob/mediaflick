import Link from 'next/link'

import { Logo } from '@/components/Logo'

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center dark:bg-black/65 dark:text-white">
            <main className="mx-auto flex h-dvh max-w-5xl flex-col items-center justify-center text-center">
                <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-background/80 p-12 backdrop-blur-sm dark:border-gray-800">
                    <h1 className="relative h-7 w-48">
                        <Logo />
                    </h1>
                </div>
            </main>
        </div>
    )
}
