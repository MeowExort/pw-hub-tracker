import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/layouts/MainLayout'
import { TeamsPage } from '@/pages/TeamsPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'
import { MatchesPage } from '@/pages/MatchesPage'
import { MatchDetailPage } from '@/pages/MatchDetailPage'
import { ClanComparePage } from '@/pages/ClanComparePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import {CentaurClanComparePage} from "@/pages/CentaurClanComparePage";
import { AnalyticsClassesPage } from '@/pages/AnalyticsClassesPage'
import { AnalyticsPlayersPage } from '@/pages/AnalyticsPlayersPage'
import { AnalyticsTimePage } from '@/pages/AnalyticsTimePage'
import { AnalyticsServersPage } from '@/pages/AnalyticsServersPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

/** Корневой компонент приложения */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/teams" replace />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/players/:server/:playerId" element={<PlayerDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchDetailPage />} />
            <Route path="/clan-compare" element={<ClanComparePage />} />
            <Route path="/centaur-clan-compare" element={<CentaurClanComparePage />} />
            <Route path="/analytics/classes" element={<AnalyticsClassesPage />} />
            <Route path="/analytics/players" element={<AnalyticsPlayersPage />} />
            <Route path="/analytics/time" element={<AnalyticsTimePage />} />
            <Route path="/analytics/servers" element={<AnalyticsServersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
