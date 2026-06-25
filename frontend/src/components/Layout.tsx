import { type ReactNode, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { ConfirmDialog, InlineSpinner } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/employees', label: 'Employees', icon: 'users' },
  { to: '/attendance', label: 'Attendance', icon: 'clock' },
  { to: '/dtr', label: 'Daily Time Record', icon: 'document' },
  { to: '/shifts', label: 'Shifts', icon: 'calendar' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/devices', label: 'Devices', icon: 'device' },
];

const LOGOUT_LOADER_DELAY = 650;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function NavIcon({ name }: { name: string }) {
  const common = 'h-4 w-4';
  const icons: Record<string, ReactNode> = {
    dashboard: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13h7V4H4v9Z" /><path d="M13 20h7V4h-7v16Z" /><path d="M4 20h7v-5H4v5Z" />
      </svg>
    ),
    users: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 11a4 4 0 1 0-8 0" /><path d="M5 20a7 7 0 0 1 14 0" /><path d="M18 8a3 3 0 0 1 2 5" />
      </svg>
    ),
    clock: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" />
      </svg>
    ),
    document: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v5h4" /><path d="M9 13h6M9 17h6" />
      </svg>
    ),
    calendar: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 6h14v14H5V6Z" /><path d="M8 4v4M16 4v4M5 10h14" />
      </svg>
    ),
    chart: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 19V5" /><path d="M5 19h14" /><path d="M9 16v-5M13 16V8M17 16v-8" />
      </svg>
    ),
    device: (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10 17h4" />
      </svg>
    ),
  };

  return icons[name] ?? null;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const current = NAV.find((n) => n.to === location.pathname)?.label ?? 'Dashboard';

  const confirmLogout = async () => {
    setLogoutLoading(true);
    await wait(LOGOUT_LOADER_DELAY);
    setLogoutConfirmOpen(false);
    setLogoutLoading(false);
    logout();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 w-72 transform border-r border-brand-800 bg-brand-950 text-white transition-transform duration-200 md:relative md:translate-x-0`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-bold tracking-wide text-brand-900 shadow-sm">{settings.logoText}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold leading-tight">{settings.appName}</div>
            <div className="truncate text-xs text-white/60">{settings.appSubtitle}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-100/75 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-current/10">
                <NavIcon name={item.icon} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/[0.08] p-3">
            <div className="text-xs uppercase tracking-wide text-white/45">Signed in</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{user?.username}</div>
            <div className="text-xs text-white/55">{user?.role}</div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Open navigation"
            >
              <span className="block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
              <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-normal text-slate-900 dark:text-slate-50">{current}</h1>
              <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">Manage records and daily attendance activity</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.username}</div>
              <div className="text-xs text-slate-400">{user?.role}</div>
            </div>
            <button onClick={() => setLogoutConfirmOpen(true)} className="btn-secondary px-3 py-1.5 text-sm" disabled={logoutLoading}>
              {logoutLoading ? <InlineSpinner label="Leaving..." /> : 'Logout'}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Confirm logout"
        message="End your current session and return to the sign-in screen?"
        confirmLabel="Logout"
        loadingLabel="Logging out..."
        loading={logoutLoading}
        tone="danger"
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    </div>
  );
}
