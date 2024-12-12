'use client'
import { Home, Library, Popcorn } from 'lucide-react'

import HeadButton from '@/components/head-bar/head-button'

export default function HeadBar() {
    return (
        <header className="border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4">
                <div className="flex items-center gap-8">
                    <div className="flex gap-2 text-3xl font-bold">
                        <span className="text-foreground">Media</span>{' '}
                        <span className="uppercase tracking-wider text-primary">Flick</span>
                    </div>
                    <div className="flex gap-2">
                        <HeadButton icon={Home} label="Home" href="/" />
                        <HeadButton icon={Library} label="Library" href="/medialibrary" />
                        <HeadButton icon={Popcorn} label="Movies" href="/mediainfo" />
                    </div>
                </div>
                <div className="flex flex-1 justify-end">
                    
                </div> 
            </div>
        </header>
    )
}
