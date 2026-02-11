import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { RecentItems } from "@/components/dashboard/recent-items"
import { MediaType } from "@/lib/api/types"

export default function Home() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your media library
        </p>
      </div>

      <DashboardStats />

      <div className="space-y-6">
        <RecentItems
          mediaType={MediaType.Movies}
          title="Recently Added Movies"
          limit={10}
        />

        <RecentItems
          mediaType={MediaType.TvShows}
          title="Recently Added Episodes"
          limit={10}
        />
      </div>
    </div>
  )
}
