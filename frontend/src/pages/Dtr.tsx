import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { DTR, Employee, Paginated } from '../types';
import { Spinner, EmptyState, Pagination } from '../components/ui';
import { useToast } from '../context/ToastContext';

function fmtTime(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function monthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthRange(value: string) {
  const [year, month] = value.split('-').map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  return {
    from: `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-${String(first.getDate()).padStart(2, '0')}`,
    to: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`,
  };
}

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function fmtMinutes(v: number) {
  const h = Math.floor(v / 60);
  const m = v % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function DtrPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<Paginated<DTR> | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(monthStr());
  const initialRange = monthRange(monthStr());
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 15 };
      if (employeeId) params.employeeId = employeeId;
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await api.get('/dtr', { params });
      setResult(res.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load DTR'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, employeeId, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/employees', { params: { pageSize: 100 } })
      .then((r) => setEmployees(r.data.data))
      .catch(() => {});
  }, []);

  const recompute = async () => {
    try {
      await api.post('/dtr/recompute', { from: from || undefined, to: to || undefined });
      toast('DTR recomputed', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Recompute failed'), 'error');
    }
  };

  const changeMonth = (value: string) => {
    const range = monthRange(value);
    setPage(1);
    setMonth(value);
    setFrom(range.from);
    setTo(range.to);
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="mr-auto min-w-44">
          <label className="label">DTR Month</label>
          <input type="month" className="input" value={month} onChange={(e) => changeMonth(e.target.value)} />
        </div>
        <div>
          <label className="label">Employee</label>
          <select className="input" value={employeeId} onChange={(e) => { setPage(1); setEmployeeId(e.target.value); }}>
            <option value="">All employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.lastName}, {emp.firstName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        <button className="btn-secondary" onClick={recompute}>Recompute</button>
      </div>

      <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
        Showing DTR for {monthLabel(month)}
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading DTR..." />
        ) : !result || result.data.length === 0 ? (
          <EmptyState title="No DTR records" subtitle="DTRs are generated automatically from attendance logs." icon="R" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th">Employee</th>
                  <th className="table-th">Shift</th>
                  <th className="table-th">Time In</th>
                  <th className="table-th">Time Out</th>
                  <th className="table-th">Total Hrs</th>
                  <th className="table-th">Late</th>
                  <th className="table-th">Undertime</th>
                  <th className="table-th">OT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {result.data.map((r) => (
                  <tr key={r.id}>
                    <td className="table-td">{fmtDate(r.date)}</td>
                    <td className="table-td font-medium">
                      {r.employee ? `${r.employee.lastName}, ${r.employee.firstName}` : '-'}
                    </td>
                    <td className="table-td">{r.employee?.shift?.name ?? 'Default Office Hours'}</td>
                    <td className="table-td">{fmtTime(r.timeIn)}</td>
                    <td className="table-td">{fmtTime(r.timeOut)}</td>
                    <td className="table-td font-semibold">{r.totalHours.toFixed(2)}</td>
                    <td className={`table-td ${r.lateMinutes > 0 ? 'text-amber-600 font-medium' : ''}`}>{fmtMinutes(r.lateMinutes)}</td>
                    <td className={`table-td ${r.undertimeMinutes > 0 ? 'text-red-600 font-medium' : ''}`}>{fmtMinutes(r.undertimeMinutes)}</td>
                    <td className={`table-td ${r.overtimeMinutes > 0 ? 'text-green-700 font-medium' : ''}`}>{fmtMinutes(r.overtimeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
