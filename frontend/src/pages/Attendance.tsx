import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { Attendance, Employee, Paginated } from '../types';
import { Spinner, EmptyState, Pagination, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const [result, setResult] = useState<Paginated<Attendance> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterDate, setFilterDate] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    employeeId: '',
    date: todayStr(),
    amTimeIn: '',
    amTimeOut: '',
    pmTimeIn: '',
    pmTimeOut: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 15 };
      if (filterDate) params.date = filterDate;
      const res = await api.get('/attendance', { params });
      setResult(res.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load attendance'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filterDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/employees', { params: { pageSize: 100 } })
      .then((r) => setEmployees(r.data.data))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setForm({
      employeeId: employees[0]?.id ? String(employees[0].id) : '',
      date: todayStr(),
      amTimeIn: '',
      amTimeOut: '',
      pmTimeIn: '',
      pmTimeOut: '',
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.employeeId) return toast('Select an employee', 'error');
    setSaving(true);
    try {
      await api.post('/attendance', {
        employeeId: Number(form.employeeId),
        date: form.date,
        amTimeIn: form.amTimeIn || null,
        amTimeOut: form.amTimeOut || null,
        pmTimeIn: form.pmTimeIn || null,
        pmTimeOut: form.pmTimeOut || null,
      });
      toast('Attendance recorded', 'success');
      setModalOpen(false);
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to record attendance'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Filter date:</label>
          <input type="date" className="input sm:w-auto" value={filterDate}
            onChange={(e) => { setPage(1); setFilterDate(e.target.value); }} />
          {filterDate && (
            <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setFilterDate('')}>Clear</button>
          )}
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Manual Entry</button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading attendance…" />
        ) : !result || result.data.length === 0 ? (
          <EmptyState title="No attendance logs" subtitle="Record manual attendance or receive from a device." icon="🕒" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Employee</th>
                  <th className="table-th">Emp No</th>
                  <th className="table-th">Event</th>
                  <th className="table-th">Timestamp</th>
                  <th className="table-th">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {result.data.map((log) => (
                  <tr key={log.id}>
                    <td className="table-td font-medium">
                      {log.employee ? `${log.employee.lastName}, ${log.employee.firstName}` : '—'}
                    </td>
                    <td className="table-td font-mono">{log.employee?.employeeNumber}</td>
                    <td className="table-td"><StatusBadge value={log.eventType} /></td>
                    <td className="table-td">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="table-td">{log.device ? log.device.name : 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal open={modalOpen} title="Manual Attendance Entry" onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Employee</label>
            <select className="input" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeNumber} — {emp.lastName}, {emp.firstName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">AM Time In</label>
              <input type="time" className="input" value={form.amTimeIn}
                onChange={(e) => setForm({ ...form, amTimeIn: e.target.value })} />
            </div>
            <div>
              <label className="label">AM Time Out</label>
              <input type="time" className="input" value={form.amTimeOut}
                onChange={(e) => setForm({ ...form, amTimeOut: e.target.value })} />
            </div>
            <div>
              <label className="label">PM Time In</label>
              <input type="time" className="input" value={form.pmTimeIn}
                onChange={(e) => setForm({ ...form, pmTimeIn: e.target.value })} />
            </div>
            <div>
              <label className="label">PM Time Out</label>
              <input type="time" className="input" value={form.pmTimeOut}
                onChange={(e) => setForm({ ...form, pmTimeOut: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            This page only accepts missing punches for today while the employee is inside the AM or PM shift window.
            Use the employee Attendance button for admin-code date edits.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
