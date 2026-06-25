import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { apiError } from '../api/client';
import { ConfirmDialog, InlineSpinner } from '../components/ui';

const AUTH_LOADER_DELAY = 650;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const confirmLogin = async () => {
    setLoading(true);
    try {
      await wait(AUTH_LOADER_DELAY);
      await login(username, password);
      setLoading(false);
      setConfirmOpen(false);
      toast('Welcome back!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      toast(apiError(err, 'Login failed'), 'error');
      setLoading(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <section className="hidden min-h-screen flex-col justify-between bg-brand-900 px-12 py-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sm font-bold tracking-wide text-brand-900 shadow-sm">
              {settings.logoText}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">{settings.appName}</div>
              <div className="text-xs text-brand-100/75">{settings.appSubtitle}</div>
            </div>
          </div>
          <div className="max-w-xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-100/70">Workforce attendance</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-normal">
              Reliable time records, approvals, and daily operations in one controlled workspace.
            </h1>
            <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-sm">
              {['DTR', 'Attendance', 'Reports'].map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-white/90">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-brand-100/65">Secure administrative access</div>
        </section>

        <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-800 text-sm font-bold tracking-wide text-white shadow-sm">
                  {settings.logoText}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">{settings.appName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{settings.appSubtitle}</div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">Welcome back</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950 dark:text-white">Sign in to your account</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Confirm your credentials before opening the admin workspace.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <label className="label" htmlFor="username">Username</label>
                <input
                  id="username"
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <InlineSpinner label="Preparing..." /> : 'Continue'}
              </button>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Default: <span className="font-mono">admin</span> / <span className="font-mono">admin123</span>
              </p>
            </form>
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm sign in"
        message={`Sign in as ${username || 'this user'} and open the ${settings.appName} workspace?`}
        confirmLabel="Sign in"
        loadingLabel="Signing in..."
        loading={loading}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmLogin}
      />
    </div>
  );
}
