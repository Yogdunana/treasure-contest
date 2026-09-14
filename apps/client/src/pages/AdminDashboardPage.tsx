/**
 * AdminDashboardPage — post-event analysis dashboard.
 *
 * Route: /admin
 *
 * Fetches data from server API endpoints and displays:
 * - 今日概览 (Today's Overview): session count, player count, avg duration, avg players
 * - 每局记录 (Game Records): expandable list with final rankings
 * - 任务统计 (Mission Statistics): sortable table with completion rate highlighting
 * - 玩家统计 (Player Statistics): sortable table with per-player stats
 * - CSV导出 (Export): download all data as CSV
 *
 * All text is in Chinese. Dark admin theme with Tailwind styling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface AdminStats {
  totalSessions: number;
  totalPlayers: number;
  avgDuration: number;
  avgPlayers: number;
}

interface GamePlayerMission {
  missionId: string;
  title?: string;
  difficulty?: string;
  completed: boolean;
  reward?: number;
}

interface GamePlayer {
  name: string;
  finalScore: number;
  finalRank: number;
  missions: GamePlayerMission[];
}

interface GameRecord {
  gameSession: number;
  roomCode: string;
  startTime: string;
  endTime: string;
  duration: number;
  playerCount: number;
  players: GamePlayer[];
}

interface MissionStat {
  missionId: string;
  title: string;
  difficulty: string;
  reward: number;
  appearedCount: number;
  completedCount: number;
  completionRate: number;
}

interface PlayerStat {
  name: string;
  gamesPlayed: number;
  avgRank: number;
  totalScore: number;
}

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------

type MissionSortKey = 'completionRate' | 'appearedCount' | 'completedCount';
type PlayerSortKey = 'totalScore' | 'gamesPlayed' | 'avgRank';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Format a duration in seconds as "X分Y秒" or "X分钟". */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (secs === 0) return `${mins}分钟`;
  return `${mins}分${secs}秒`;
}

/** Format an ISO timestamp as "HH:MM". */
function formatTime(isoString: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

/** Map difficulty key to Chinese label. */
function difficultyLabel(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return '简单';
    case 'medium':
      return '中等';
    case 'hard':
      return '困难';
    default:
      return difficulty;
  }
}

/** Tailwind classes for difficulty badge. */
function difficultyBadgeClass(difficulty: string): string {
  switch (difficulty) {
    case 'easy':
      return 'bg-emerald-500/20 text-emerald-400';
    case 'medium':
      return 'bg-amber-500/20 text-amber-400';
    case 'hard':
      return 'bg-rose-500/20 text-rose-400';
    default:
      return 'bg-slate-600/20 text-slate-400';
  }
}

/** Tailwind classes for rank medal. */
function rankBadgeClass(rank: number): string {
  switch (rank) {
    case 1:
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 2:
      return 'bg-slate-400/20 text-slate-300 border-slate-400/30';
    case 3:
      return 'bg-orange-700/20 text-orange-500 border-orange-700/30';
    default:
      return 'bg-slate-700/40 text-slate-500 border-slate-600/30';
  }
}

/** Count completed missions out of total. */
function countCompletedMissions(missions: GamePlayerMission[]): { completed: number; total: number } {
  return {
    completed: missions.filter((m) => m.completed).length,
    total: missions.length,
  };
}

// ---------------------------------------------------------------------------
// Small presentational components
// ---------------------------------------------------------------------------

/** Sort direction indicator arrow. */
function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <span className="ml-1 text-slate-600">↕</span>;
  }
  return <span className="ml-1 text-violet-400">{dir === 'asc' ? '↑' : '↓'}</span>;
}

/** Single stat card for the overview section. */
function StatCard({
  label,
  value,
  unit,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg', accent)}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-slate-100">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin auth state
// ---------------------------------------------------------------------------

const ADMIN_TOKEN_KEY = 'tc_admin_token';

/** Read stored token from localStorage. */
function getStoredToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Store token in localStorage. */
function setStoredToken(token: string): void {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

/** Remove stored token. */
function clearStoredToken(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
}

/** Build fetch headers with token if available. */
function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="4" />
      <path d="M7 12h3M8.5 10.5v3" />
      <circle cx="15.5" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75M22 21a7 7 0 0 0-3-5.74" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function AvgUsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
      <path d="M19 4l1 1-1 1M20 5h-3" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l9-9 9 9M5 10v10h14V10" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Login form component
// ---------------------------------------------------------------------------

function LoginForm({ onSuccess, onBack }: { onSuccess: () => void; onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) {
        setError('请输入密码');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || '登录失败');
          return;
        }

        // Store token for Authorization header (in addition to cookie).
        if (data.token) {
          setStoredToken(data.token);
        }

        onSuccess();
      } catch {
        setError('网络错误，请稍后重试');
      } finally {
        setLoading(false);
      }
    },
    [password, onSuccess],
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15">
            <LockIcon className="h-8 w-8 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-100">管理后台登录</h1>
          <p className="text-sm text-slate-500">请输入管理密码以继续</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-rose-800/50 bg-rose-950/30 px-4 py-2.5 text-sm text-rose-400">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              管理密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="mt-3 w-full text-center text-xs text-slate-500 transition-colors hover:text-slate-400"
          >
            返回首页
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  // ── Auth state ─────────────────────────────────────────────────────────
  const [authed, setAuthed] = useState<boolean | null>(null); // null = checking

  // Check auth on mount
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthed(false);
      return;
    }
    // Verify token with server
    fetch('/api/admin/check', { credentials: 'include', headers: authHeaders() })
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false));
  }, []);

  // ── Data state ─────────────────────────────────────────────────────────
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [missions, setMissions] = useState<MissionStat[]>([]);
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ───────────────────────────────────────────────────────────
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [missionSortKey, setMissionSortKey] = useState<MissionSortKey>('completionRate');
  const [missionSortDir, setMissionSortDir] = useState<SortDir>('desc');
  const [playerSortKey, setPlayerSortKey] = useState<PlayerSortKey>('totalScore');
  const [playerSortDir, setPlayerSortDir] = useState<SortDir>('desc');

  // ── Fetch all data ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const reqInit: RequestInit = { credentials: 'include', headers: authHeaders() };
      const [statsRes, gamesRes, missionsRes, playersRes] = await Promise.all([
        fetch('/api/admin/stats', reqInit),
        fetch('/api/admin/games', reqInit),
        fetch('/api/admin/missions', reqInit),
        fetch('/api/admin/players', reqInit),
      ]);

      // If any request returns 401, token expired — kick back to login.
      if ([statsRes, gamesRes, missionsRes, playersRes].some((r) => r.status === 401)) {
        clearStoredToken();
        setAuthed(false);
        return;
      }

      const responses = [statsRes, gamesRes, missionsRes, playersRes];
      for (const res of responses) {
        if (!res.ok) {
          throw new Error(`请求失败 (${res.status} ${res.statusText})`);
        }
      }

      const [statsData, gamesData, missionsData, playersData] = await Promise.all([
        statsRes.json() as Promise<AdminStats>,
        gamesRes.json() as Promise<GameRecord[]>,
        missionsRes.json() as Promise<MissionStat[]>,
        playersRes.json() as Promise<PlayerStat[]>,
      ]);

      setStats(statsData);
      setGames(gamesData);
      setMissions(missionsData);
      setPlayers(playersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── CSV export ─────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    // Use a fetch + blob approach to include auth headers.
    fetch('/api/admin/export', { credentials: 'include', headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error('导出失败');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'treasure-contest-export.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '导出失败'));
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      });
    } catch {
      // ignore network errors on logout
    }
    clearStoredToken();
    setAuthed(false);
  }, []);

  // ── Sort handlers ──────────────────────────────────────────────────────
  const handleMissionSort = useCallback(
    (key: MissionSortKey) => {
      if (key === missionSortKey) {
        setMissionSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setMissionSortKey(key);
        setMissionSortDir('desc');
      }
    },
    [missionSortKey],
  );

  const handlePlayerSort = useCallback(
    (key: PlayerSortKey) => {
      if (key === playerSortKey) {
        setPlayerSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setPlayerSortKey(key);
        // For avgRank, ascending means best rank first; for others, descending
        setPlayerSortDir(key === 'avgRank' ? 'asc' : 'desc');
      }
    },
    [playerSortKey],
  );

  // ── Expand/collapse game record ────────────────────────────────────────
  const toggleExpand = useCallback((session: number) => {
    setExpandedSession((prev) => (prev === session ? null : session));
  }, []);

  // ── Sorted & computed data ─────────────────────────────────────────────
  const sortedMissions = useMemo(() => {
    return [...missions].sort((a, b) => {
      const dir = missionSortDir === 'asc' ? 1 : -1;
      return (a[missionSortKey] - b[missionSortKey]) * dir;
    });
  }, [missions, missionSortKey, missionSortDir]);

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const dir = playerSortDir === 'asc' ? 1 : -1;
      return (a[playerSortKey] - b[playerSortKey]) * dir;
    });
  }, [players, playerSortKey, playerSortDir]);

  const maxCompletionRate = useMemo(() => {
    if (missions.length === 0) return 0;
    return Math.max(...missions.map((m) => m.completionRate));
  }, [missions]);

  const minCompletionRate = useMemo(() => {
    if (missions.length === 0) return 0;
    return Math.min(...missions.map((m) => m.completionRate));
  }, [missions]);

  // ── Auth gate: show login or checking state ────────────────────────────
  if (authed === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-400">
        <svg className="h-10 w-10 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm">正在验证身份...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <LoginForm
        onSuccess={() => {
          setAuthed(true);
          fetchData();
        }}
        onBack={() => navigate('/')}
      />
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-400">
        <svg className="h-12 w-12 animate-spin text-violet-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-lg">正在加载数据...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-slate-400">
        <div className="rounded-2xl border border-rose-800/50 bg-rose-950/20 px-8 py-6 text-center">
          <p className="mb-2 text-xl font-bold text-rose-400">加载失败</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-violet-500"
          >
            <RefreshIcon className="h-4 w-4" />
            重新加载
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-bold text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
          >
            <HomeIcon className="h-4 w-4" />
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // ── Main content ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-violet-400">管理后台</h1>
            <p className="mt-1 text-sm text-slate-500">赛后数据分析与统计</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              刷新
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-rose-800/50 px-3 py-2 text-xs font-medium text-rose-400 transition-colors hover:border-rose-700 hover:text-rose-300"
            >
              <LogoutIcon className="h-3.5 w-3.5" />
              退出登录
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-300"
            >
              <HomeIcon className="h-3.5 w-3.5" />
              首页
            </button>
          </div>
        </header>

        {/* ── 今日概览 ────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">今日概览</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              label="今日场次"
              value={stats?.totalSessions ?? 0}
              unit="场"
              accent="bg-violet-500/15 text-violet-400"
              icon={<GamepadIcon className="h-5 w-5" />}
            />
            <StatCard
              label="参与玩家"
              value={stats?.totalPlayers ?? 0}
              unit="人"
              accent="bg-blue-500/15 text-blue-400"
              icon={<UsersIcon className="h-5 w-5" />}
            />
            <StatCard
              label="平均时长"
              value={formatDuration(stats?.avgDuration ?? 0)}
              accent="bg-emerald-500/15 text-emerald-400"
              icon={<ClockIcon className="h-5 w-5" />}
            />
            <StatCard
              label="场均人数"
              value={stats?.avgPlayers ?? 0}
              unit="人"
              accent="bg-amber-500/15 text-amber-400"
              icon={<AvgUsersIcon className="h-5 w-5" />}
            />
          </div>
        </section>

        {/* ── 每局记录 ────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            每局记录
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({games.length} 场)
            </span>
          </h2>

          {games.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-10 text-center text-sm text-slate-600">
              今日暂无对局记录
            </div>
          ) : (
            <div className="space-y-2">
              {games.map((game) => {
                const isExpanded = expandedSession === game.gameSession;
                const rankedPlayers = [...game.players].sort(
                  (a, b) => a.finalRank - b.finalRank,
                );

                return (
                  <div
                    key={game.gameSession}
                    className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"
                  >
                    {/* Summary row */}
                    <button
                      onClick={() => toggleExpand(game.gameSession)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-4">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-bold text-violet-400">
                          {game.gameSession}
                        </span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                          <span className="text-slate-300">
                            <span className="text-slate-500">房间 </span>
                            <span className="font-mono">{game.roomCode}</span>
                          </span>
                          <span className="text-slate-300">
                            <span className="text-slate-500">时间 </span>
                            {formatTime(game.startTime)} - {formatTime(game.endTime)}
                          </span>
                          <span className="text-slate-300">
                            <span className="text-slate-500">时长 </span>
                            {formatDuration(game.duration)}
                          </span>
                          <span className="text-slate-300">
                            <span className="text-slate-500">人数 </span>
                            {game.playerCount}
                          </span>
                        </div>
                      </div>
                      <ChevronIcon
                        className={clsx(
                          'h-5 w-5 shrink-0 text-slate-500 transition-transform',
                          isExpanded && 'rotate-180',
                        )}
                      />
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-slate-800"
                        >
                          <div className="overflow-x-auto px-4 py-3">
                            <table className="w-full min-w-[480px] text-sm">
                              <thead>
                                <tr className="text-left text-xs text-slate-500">
                                  <th className="px-3 py-2 font-medium">排名</th>
                                  <th className="px-3 py-2 font-medium">玩家</th>
                                  <th className="px-3 py-2 text-right font-medium">得分</th>
                                  <th className="px-3 py-2 text-right font-medium">任务完成</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rankedPlayers.map((player) => {
                                  const { completed, total } = countCompletedMissions(player.missions);
                                  return (
                                    <tr
                                      key={player.name}
                                      className="border-t border-slate-800/50"
                                    >
                                      <td className="px-3 py-2">
                                        <span
                                          className={clsx(
                                            'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                                            rankBadgeClass(player.finalRank),
                                          )}
                                        >
                                          {player.finalRank}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2 font-medium text-slate-200">
                                        {player.name}
                                      </td>
                                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-100">
                                        {player.finalScore}
                                      </td>
                                      <td className="px-3 py-2 text-right text-slate-400">
                                        {completed}/{total}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 任务统计 ────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            任务统计
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({missions.length} 个任务)
            </span>
          </h2>

          {missions.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-10 text-center text-sm text-slate-600">
              暂无任务数据
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">任务ID</th>
                    <th className="px-4 py-3 font-medium">任务名称</th>
                    <th className="px-4 py-3 font-medium">难度</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handleMissionSort('appearedCount')}
                    >
                      出现次数
                      <SortArrow active={missionSortKey === 'appearedCount'} dir={missionSortDir} />
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handleMissionSort('completedCount')}
                    >
                      完成次数
                      <SortArrow active={missionSortKey === 'completedCount'} dir={missionSortDir} />
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handleMissionSort('completionRate')}
                    >
                      完成率
                      <SortArrow active={missionSortKey === 'completionRate'} dir={missionSortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMissions.map((mission) => {
                    const isMax = mission.completionRate === maxCompletionRate && maxCompletionRate > 0;
                    const isMin = mission.completionRate === minCompletionRate && missions.length > 1;

                    return (
                      <tr
                        key={mission.missionId}
                        className={clsx(
                          'border-b border-slate-800/50 transition-colors hover:bg-slate-800/30',
                          isMax && 'bg-emerald-950/20',
                          isMin && 'bg-rose-950/20',
                        )}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">
                          {mission.missionId}
                        </td>
                        <td className="px-4 py-3 text-slate-200">{mission.title}</td>
                        <td className="px-4 py-3">
                          <span
                            className={clsx(
                              'inline-block rounded px-2 py-0.5 text-xs font-medium',
                              difficultyBadgeClass(mission.difficulty),
                            )}
                          >
                            {difficultyLabel(mission.difficulty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {mission.appearedCount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {mission.completedCount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={clsx(
                              'font-mono font-bold',
                              isMax ? 'text-emerald-400' : isMin ? 'text-rose-400' : 'text-slate-200',
                            )}
                          >
                            {(mission.completionRate * 100).toFixed(1)}%
                          </span>
                          {isMax && (
                            <span className="ml-1 text-xs text-emerald-500">↑最高</span>
                          )}
                          {isMin && (
                            <span className="ml-1 text-xs text-rose-500">↓最低</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* Sort controls for appearedCount and completedCount */}
          {missions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <button
                onClick={() => handleMissionSort('appearedCount')}
                className={clsx(
                  'flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium transition-colors',
                  missionSortKey === 'appearedCount'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600',
                )}
              >
                按出现次数排序
                {missionSortKey === 'appearedCount' && (
                  <SortArrow active={true} dir={missionSortDir} />
                )}
              </button>
              <button
                onClick={() => handleMissionSort('completedCount')}
                className={clsx(
                  'flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium transition-colors',
                  missionSortKey === 'completedCount'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600',
                )}
              >
                按完成次数排序
                {missionSortKey === 'completedCount' && (
                  <SortArrow active={true} dir={missionSortDir} />
                )}
              </button>
              <button
                onClick={() => handleMissionSort('completionRate')}
                className={clsx(
                  'flex items-center gap-1 rounded-lg border px-3 py-1.5 font-medium transition-colors',
                  missionSortKey === 'completionRate'
                    ? 'border-violet-500/50 bg-violet-500/10 text-violet-400'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600',
                )}
              >
                按完成率排序
                {missionSortKey === 'completionRate' && (
                  <SortArrow active={true} dir={missionSortDir} />
                )}
              </button>
            </div>
          )}
        </section>

        {/* ── 玩家统计 ────────────────────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-200">
            玩家统计
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({players.length} 位玩家)
            </span>
          </h2>

          {players.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 py-10 text-center text-sm text-slate-600">
              暂无玩家数据
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                    <th className="px-4 py-3 font-medium">玩家名称</th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handlePlayerSort('gamesPlayed')}
                    >
                      参与局数
                      <SortArrow active={playerSortKey === 'gamesPlayed'} dir={playerSortDir} />
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handlePlayerSort('avgRank')}
                    >
                      平均排名
                      <SortArrow active={playerSortKey === 'avgRank'} dir={playerSortDir} />
                    </th>
                    <th
                      className="cursor-pointer px-4 py-3 text-right font-medium hover:text-slate-300"
                      onClick={() => handlePlayerSort('totalScore')}
                    >
                      总得分
                      <SortArrow active={playerSortKey === 'totalScore'} dir={playerSortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, i) => (
                    <tr
                      key={player.name}
                      className={clsx(
                        'border-b border-slate-800/50 transition-colors hover:bg-slate-800/30',
                        i === 0 && 'bg-amber-950/10',
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-slate-200">{player.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {player.gamesPlayed}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {player.avgRank.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-100">
                        {player.totalScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── CSV导出 ────────────────────────────────────────────────── */}
        <section className="flex justify-center border-t border-slate-800 pt-6">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-500 active:scale-95"
          >
            <DownloadIcon className="h-4 w-4" />
            导出全部数据 (CSV)
          </button>
        </section>
      </div>
    </div>
  );
}
