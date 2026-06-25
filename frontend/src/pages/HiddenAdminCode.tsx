import { useState } from 'react';
import { api, apiError } from '../api/client';
import { useToast } from '../context/ToastContext';

export default function HiddenAdminCode() {
  const { toast } = useToast();
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCode !== confirmCode) return toast('New admin codes do not match', 'error');

    setSaving(true);
    try {
      await api.put('/_hidden/admin-code', { currentCode, newCode });
      toast('Admin code updated', 'success');
      setCurrentCode('');
      setNewCode('');
      setConfirmCode('');
    } catch (err) {
      toast(apiError(err, 'Failed to update admin code'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Code</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hidden attendance edit code settings.</p>
      </div>

      <form onSubmit={save} className="card space-y-4">
        <div>
          <label className="label">Current Admin Code</label>
          <input
            type="password"
            className="input"
            value={currentCode}
            onChange={(e) => setCurrentCode(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">New Admin Code</label>
          <input
            type="password"
            className="input"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            minLength={4}
            required
          />
        </div>
        <div>
          <label className="label">Confirm New Code</label>
          <input
            type="password"
            className="input"
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            minLength={4}
            required
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Update Code'}
          </button>
        </div>
      </form>
    </div>
  );
}
