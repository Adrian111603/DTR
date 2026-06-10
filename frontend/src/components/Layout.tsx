import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/employees', label: 'Employees', icon: 'E' },
  { to: '/attendance', label: 'Attendance', icon: 'A' },
  { to: '/dtr', label: 'Daily Time Record', icon: 'R' },
  { to: '/shifts', label: 'Shifts', icon: 'S' },
  { to: '/reports', label: 'Reports', icon: 'P' },
  { to: '/devices', label: 'Devices', icon: 'B' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const { settings } = useSettings();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const current = NAV.find((n) => n.to === location.pathname)?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-30 w-64 transform bg-brand-900 text-white transition-transform duration-200 md:relative md:translate-x-0`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded bg-white/10 text-sm font-bold">{settings.logoText}</span>
          <div>
            <div className="text-sm font-bold leading-tight">{settings.appName}</div>
            <div className="text-xs text-white/60">{settings.appSubtitle}</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <span className="flex h-6 w-6 items-center justify-center rounded bg-white/10 text-xs font-semibold">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4 text-xs text-white/50">
          Signed in as <span className="font-semibold text-white/80">{user?.username}</span>
          <div>{user?.role}</div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 md:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
              onClick={() => setSidebarOpen((o) => !o)}
            >
              Menu
            </button>
            <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{current}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Toggle theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username}</div>
              <div className="text-xs text-gray-400">{user?.role}</div>
            </div>
            <button onClick={logout} className="btn-secondary px-3 py-1.5 text-sm">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
