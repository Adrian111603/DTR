import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { apiError } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast('Welcome back!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      toast(apiError(err, 'Login failed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-lg font-bold">{settings.logoText}</div>
          <h1 className="mt-3 text-2xl font-bold">{settings.appName}</h1>
          <p className="text-sm text-white/70">{settings.appSubtitle}</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
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
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Default: <span className="font-mono">admin</span> / <span className="font-mono">admin123</span>
          </p>
        </form>
      </div>
    </div>
  );
}
