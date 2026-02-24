import { A } from "@solidjs/router";

export default function NotFoundPage() {
    return (
        <section class="py-20 text-center space-y-4">
            <h2 class="text-3xl font-bold">404</h2>
            <p class="text-text-secondary">This route does not exist.</p>
            <div class="flex justify-center gap-4">
                <A href="/" class="text-accent hover:text-accent-hover transition text-sm">Dashboard</A>
                <A href="/shows" class="text-accent hover:text-accent-hover transition text-sm">TV Shows</A>
                <A href="/movies" class="text-accent hover:text-accent-hover transition text-sm">Movies</A>
                <A href="/archive" class="text-accent hover:text-accent-hover transition text-sm">Archive</A>
                <A href="/wanted" class="text-accent hover:text-accent-hover transition text-sm">Wanted</A>
            </div>
        </section>
    );
}
