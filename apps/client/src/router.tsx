import { Routes, Route } from 'react-router-dom';

// Lazy load page components to keep the initial bundle small.
// Each page is only loaded when the user navigates to the corresponding route.
import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';

// ---------------------------------------------------------------------------
// Page components (lazy-loaded for code splitting)
// ---------------------------------------------------------------------------

const LandingPage = lazy(() => import('./pages/LandingPage')) as unknown as ComponentType;
const PlayerJoinPage = lazy(() => import('./pages/player/PlayerJoinPage')) as unknown as ComponentType;
const PlayerGamePage = lazy(() => import('./pages/player/PlayerGamePage')) as unknown as ComponentType;
const ScreenPage = lazy(() => import('./pages/ScreenPage')) as unknown as ComponentType;
const HostCreatePage = lazy(() => import('./pages/HostCreatePage')) as unknown as ComponentType;
const HostPanelPage = lazy(() => import('./pages/HostPanelPage')) as unknown as ComponentType;
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage')) as unknown as ComponentType;

/** Simple loading fallback shown while a lazy page chunk is being fetched. */
function PageFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
      <div className="animate-pulse text-lg">Loading...</div>
    </div>
  );
}

/**
 * Application route tree.
 *
 * Route layout:
 * - `/`                        LandingPage   — QR code / room code entry
 * - `/play/:roomCode`          PlayerJoinPage — name entry, join room
 * - `/play/:roomCode/game`     PlayerGamePage — main player game UI
 * - `/screen/:roomCode`        ScreenPage     — big-screen display
 * - `/host/create`             HostCreatePage — host creates a new room
 * - `/host/:roomCode`          HostPanelPage  — host control panel
 * - `/admin`                   AdminDashboardPage — admin dashboard
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play/:roomCode" element={<PlayerJoinPage />} />
        <Route path="/play/:roomCode/game" element={<PlayerGamePage />} />
        <Route path="/screen/:roomCode" element={<ScreenPage />} />
        <Route path="/host/create" element={<HostCreatePage />} />
        <Route path="/host/:roomCode" element={<HostPanelPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Suspense>
  );
}
