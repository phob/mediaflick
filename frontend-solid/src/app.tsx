import { Route, Router } from "@solidjs/router";
import { AppShell } from "@/components/app-shell";
import ArchivePage from "@/pages/archive-page";
import DashboardPage from "@/pages/dashboard-page";
import LogsPage from "@/pages/logs-page";
import MovieDetailsPage from "@/pages/movie-details-page";
import MoviesPage from "@/pages/movies-page";
import NotFoundPage from "@/pages/not-found-page";
import SettingsPage from "@/pages/settings-page";
import TvShowDetailsPage from "@/pages/tv-show-details-page";
import TvShowsPage from "@/pages/tv-shows-page";
import UnidentifiedPage from "@/pages/unidentified-page";
import WantedPage from "@/pages/wanted-page";

export default function App() {
    return (
        <Router root={AppShell}>
            <Route path="/" component={DashboardPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/shows" component={TvShowsPage} />
            <Route path="/shows/:tmdbId" component={TvShowDetailsPage} />
            <Route path="/movies" component={MoviesPage} />
            <Route path="/movies/:tmdbId" component={MovieDetailsPage} />
            <Route path="/archive" component={ArchivePage} />
            <Route path="/wanted" component={WantedPage} />
            <Route path="/unidentified" component={UnidentifiedPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/logs" component={LogsPage} />
            <Route path="*" component={NotFoundPage} />
        </Router>
    );
}
