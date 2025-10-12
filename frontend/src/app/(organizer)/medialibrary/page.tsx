"use client"

import { Suspense } from 'react'
import { MediaLibraryContent } from './content'

export default function MediaLibrary() {
    return (
        <div className="container mx-auto py-6 motion-blur-in-md motion-opacity-in-0 motion-duration-500">
            <h1 className="mb-6 text-2xl font-bold motion-translate-y-in-100 motion-delay-400">Media Library</h1>
            <Suspense>
                <MediaLibraryContent />
            </Suspense>
        </div>
    )
}
