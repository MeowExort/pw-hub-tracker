import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/layouts/MainLayout'
import { TeamsPage } from '@/pages/TeamsPage'
import { TeamDetailPage } from '@/pages/TeamDetailPage'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'
import { MatchesPage } from '@/pages/MatchesPage'
import { MatchDetailPage } from '@/pages/MatchDetailPage'
import { ClanComparePage } from '@/pages/ClanComparePage'
import { PlayersPage } from '@/pages/PlayersPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import {CentaurClanComparePage} from "@/pages/CentaurClanComparePage";
import { AnalyticsClassesPage } from '@/pages/AnalyticsClassesPage'
import { AnalyticsPlayersPage } from '@/pages/AnalyticsPlayersPage'
import { AnalyticsTimePage } from '@/pages/AnalyticsTimePage'
import { AnalyticsServersPage } from '@/pages/AnalyticsServersPage'
import {MizarClanComparePage} from "@/pages/MizarClanComparePage";
import { MarketDashboardPage } from '@/pages/MarketDashboardPage'
import { ShopsPage } from '@/pages/ShopsPage'
import { ShopProfilePage } from '@/pages/ShopProfilePage'
import { TradeAnalyticsPage } from '@/pages/TradeAnalyticsPage'
import { BotDetectorPage } from '@/pages/BotDetectorPage'
import { ItemsPage } from '@/pages/ItemsPage'
import { ItemDetailsPage } from '@/pages/ItemDetailsPage'
import { CaptchaModal } from '@/shared/ui/CaptchaModal'

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
      <CaptchaModal />
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/teams" replace />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:teamId" element={<TeamDetailPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/players/:server/:playerId" element={<PlayerDetailPage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:matchId" element={<MatchDetailPage />} />
            <Route path="/clan-compare" element={<ClanComparePage />} />
            <Route path="/centaur-clan-compare" element={<CentaurClanComparePage />} />
            <Route path="/mizar-clan-compare" element={<MizarClanComparePage />} />
            <Route path="/market" element={<MarketDashboardPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/shops/:server/:playerId" element={<ShopProfilePage />} />
            <Route path="/trades" element={<TradeAnalyticsPage />} />
            <Route path="/bots" element={<BotDetectorPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/items/:id" element={<ItemDetailsPage />} />
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
