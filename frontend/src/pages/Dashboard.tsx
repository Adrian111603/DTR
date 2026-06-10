import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { api, apiError } from '../api/client';
import { DashboardStats, ChartPoint } from '../types';
import { Spinner, EmptyState, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [weekly, setWeekly] = useState<ChartPoint[]>([]);
  const [monthly, setMonthly] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, w, m] = await Promise.all([
          api.get('/dashboard/stats'),
          api.get('/dashboard/weekly'),
          api.get('/dashboard/monthly'),
        ]);
        setStats(s.data);
        setWeekly(w.data);
        setMonthly(m.data);
      } catch (err) {
        toast(apiError(err, 'Failed to load dashboard'), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <Spinner label="Loading dashboard…" />;
  if (!stats) return <EmptyState title="No data available" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Employees" value={stats.totalEmployees} icon="👥" color="bg-brand-100 text-brand-700" />
        <StatCard label="Present Today" value={stats.presentToday} icon="✅" color="bg-green-100 text-green-700" />
        <StatCard label="Absent Today" value={stats.absentToday} icon="❌" color="bg-red-100 text-red-700" />
        <StatCard label="Late Today" value={stats.lateToday} icon="⏰" color="bg-amber-100 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">Weekly Attendance</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="present" name="Present" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-gray-100">Monthly Attendance</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="present" name="Present" stroke="#1d4ed8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Recent Attendance Logs</h2>
        </div>
        {stats.recentLogs.length === 0 ? (
          <EmptyState title="No attendance logs yet" subtitle="Logs appear here as employees punch in." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Employee</th>
                  <th className="table-th">Emp No</th>
                  <th className="table-th">Event</th>
                  <th className="table-th">Time</th>
                  <th className="table-th">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {stats.recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="table-td font-medium">
                      {log.employee ? `${log.employee.lastName}, ${log.employee.firstName}` : '—'}
                    </td>
                    <td className="table-td">{log.employee?.employeeNumber}</td>
                    <td className="table-td"><StatusBadge value={log.eventType} /></td>
                    <td className="table-td">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="table-td">{log.device ? log.device.name : 'Manual'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
