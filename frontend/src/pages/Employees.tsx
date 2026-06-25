import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { DTR, Employee, EmploymentStatus, Paginated, Shift } from '../types';
import { Spinner, EmptyState, Pagination, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';

const STATUSES: EmploymentStatus[] = ['REGULAR', 'CONTRACTUAL', 'CASUAL', 'JOB_ORDER', 'COTERMINOUS'];
type AttendancePeriod = 'daily' | 'weekly' | 'monthly';
type AttendanceDayForm = {
  amTimeIn: string;
  amTimeOut: string;
  pmTimeIn: string;
  pmTimeOut: string;
  adminCode: string;
};

const empty = {
  employeeNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  department: '',
  position: '',
  status: 'REGULAR' as EmploymentStatus,
  shiftId: '',
};

const emptyAttendanceDay: AttendanceDayForm = {
  amTimeIn: '',
  amTimeOut: '',
  pmTimeIn: '',
  pmTimeOut: '',
  adminCode: '',
};

function dateInputValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(v: string) {
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(v?: string | null) {
  if (!v) return '-';
  return new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtHours(v: number) {
  return `${v.toFixed(2)} hrs`;
}

function periodRange(period: AttendancePeriod, value: string) {
  const base = value ? new Date(value) : new Date();
  let from = new Date(base);
  let to = new Date(base);

  if (period === 'weekly') {
    const day = base.getDay();
    from = new Date(base);
    from.setDate(base.getDate() - ((day + 6) % 7));
    to = new Date(from);
    to.setDate(from.getDate() + 6);
  }

  if (period === 'monthly') {
    from = new Date(base.getFullYear(), base.getMonth(), 1);
    to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  }

  return { from: dateInputValue(from), to: dateInputValue(to) };
}

export default function Employees() {
  const { toast } = useToast();
  const [result, setResult] = useState<Paginated<Employee> | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceEmployee, setAttendanceEmployee] = useState<Employee | null>(null);
  const [attendancePeriod, setAttendancePeriod] = useState<AttendancePeriod>('daily');
  const [attendanceDate, setAttendanceDate] = useState(dateInputValue());
  const [attendanceRows, setAttendanceRows] = useState<DTR[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceDayForm, setAttendanceDayForm] = useState<AttendanceDayForm>(emptyAttendanceDay);
  const [attendanceDayLoading, setAttendanceDayLoading] = useState(false);
  const [attendanceDaySaving, setAttendanceDaySaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees', { params: { page, pageSize: 10, search } });
      setResult(res.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load employees'), 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, toast]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api.get('/shifts')
      .then((r) => setShifts(r.data))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      employeeNumber: emp.employeeNumber,
      firstName: emp.firstName,
      middleName: emp.middleName ?? '',
      lastName: emp.lastName,
      department: emp.department,
      position: emp.position,
      status: emp.status,
      shiftId: emp.shiftId ? String(emp.shiftId) : '',
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      shiftId: form.shiftId ? Number(form.shiftId) : null,
    };

    try {
      if (editing) {
        await api.put(`/employees/${editing.id}`, payload);
        toast('Employee updated', 'success');
      } else {
        await api.post('/employees', payload);
        toast('Employee added', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to save employee'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (emp: Employee) => {
    if (!confirm(`Delete ${emp.firstName} ${emp.lastName}? This also removes their attendance and DTR.`)) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      toast('Employee deleted', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to delete'), 'error');
    }
  };

  const openAttendance = (emp: Employee) => {
    setAttendanceEmployee(emp);
    setAttendanceRows([]);
    setAttendanceDayForm(emptyAttendanceDay);
    setAttendancePeriod('daily');
    setAttendanceDate(dateInputValue());
    setAttendanceOpen(true);
  };

  const loadAttendance = useCallback(async () => {
    if (!attendanceEmployee) return;
    setAttendanceLoading(true);
    try {
      const range = periodRange(attendancePeriod, attendanceDate);
      const res = await api.get('/dtr', {
        params: {
          employeeId: attendanceEmployee.id,
          from: range.from,
          to: range.to,
          pageSize: 200,
        },
      });
      setAttendanceRows(res.data.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load attendance hours'), 'error');
    } finally {
      setAttendanceLoading(false);
    }
  }, [attendanceEmployee, attendanceDate, attendancePeriod, toast]);

  const loadAttendanceDay = useCallback(async () => {
    if (!attendanceEmployee) return;
    setAttendanceDayLoading(true);
    try {
      const res = await api.get(`/employees/${attendanceEmployee.id}/attendance-day`, {
        params: { date: attendanceDate },
      });
      setAttendanceDayForm((prev) => ({
        ...prev,
        amTimeIn: res.data.amTimeIn ?? '',
        amTimeOut: res.data.amTimeOut ?? '',
        pmTimeIn: res.data.pmTimeIn ?? '',
        pmTimeOut: res.data.pmTimeOut ?? '',
      }));
    } catch (err) {
      toast(apiError(err, 'Failed to load date attendance'), 'error');
    } finally {
      setAttendanceDayLoading(false);
    }
  }, [attendanceEmployee, attendanceDate, toast]);

  const saveAttendanceDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceEmployee) return;
    if (!attendanceDayForm.adminCode) return toast('Enter the admin code', 'error');

    setAttendanceDaySaving(true);
    try {
      await api.put(`/employees/${attendanceEmployee.id}/attendance-day`, {
        date: attendanceDate,
        adminCode: attendanceDayForm.adminCode,
        amTimeIn: attendanceDayForm.amTimeIn || null,
        amTimeOut: attendanceDayForm.amTimeOut || null,
        pmTimeIn: attendanceDayForm.pmTimeIn || null,
        pmTimeOut: attendanceDayForm.pmTimeOut || null,
      });
      toast('Attendance date updated', 'success');
      setAttendanceDayForm((prev) => ({ ...prev, adminCode: '' }));
      loadAttendance();
    } catch (err) {
      toast(apiError(err, 'Failed to update attendance date'), 'error');
    } finally {
      setAttendanceDaySaving(false);
    }
  };

  useEffect(() => {
    if (attendanceOpen) {
      loadAttendance();
      loadAttendanceDay();
    }
  }, [attendanceOpen, loadAttendance, loadAttendanceDay]);

  const attendanceRange = periodRange(attendancePeriod, attendanceDate);
  const attendanceTotalHours = attendanceRows.reduce((sum, row) => sum + row.totalHours, 0);
  const attendanceLateMinutes = attendanceRows.reduce((sum, row) => sum + row.lateMinutes, 0);
  const attendanceUndertimeMinutes = attendanceRows.reduce((sum, row) => sum + row.undertimeMinutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="input sm:max-w-xs"
          placeholder="Search name, number, department..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <button className="btn-primary" onClick={openAdd}>+ Add Employee</button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading employees..." />
        ) : !result || result.data.length === 0 ? (
          <EmptyState title="No employees found" subtitle="Add your first employee to get started." icon="E" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Emp No</th>
                  <th className="table-th">Name</th>
                  <th className="table-th">Department</th>
                  <th className="table-th">Position</th>
                  <th className="table-th">Shift</th>
                  <th className="table-th">Status</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {result.data.map((emp) => (
                  <tr key={emp.id}>
                    <td className="table-td font-mono">{emp.employeeNumber}</td>
                    <td className="table-td font-medium">
                      {emp.lastName}, {emp.firstName} {emp.middleName ? emp.middleName.charAt(0) + '.' : ''}
                    </td>
                    <td className="table-td">{emp.department}</td>
                    <td className="table-td">{emp.position}</td>
                    <td className="table-td">{emp.shift?.name ?? 'Default Office Hours'}</td>
                    <td className="table-td"><StatusBadge value={emp.status} /></td>
                    <td className="table-td">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => openAttendance(emp)}>Attendance</button>
                        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => openEdit(emp)}>Edit</button>
                        <button className="btn-danger px-3 py-1 text-xs" onClick={() => remove(emp)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={result.page} totalPages={result.totalPages} total={result.total} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Employee' : 'Add Employee'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Employee Number</label>
              <input className="input" required value={form.employeeNumber}
                onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} />
            </div>
            <div>
              <label className="label">Employment Status</label>
              <select className="input" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as EmploymentStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">First Name</label>
              <input className="input" required value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Middle Name</label>
              <input className="input" value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" required value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div>
              <label className="label">Department</label>
              <input className="input" required value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" required value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
            <div>
              <label className="label">Shift</label>
              <select className="input" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
                <option value="">Default Office Hours</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>{shift.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={attendanceOpen}
        title={attendanceEmployee ? `${attendanceEmployee.firstName} ${attendanceEmployee.lastName} Attendance` : 'Attendance'}
        onClose={() => setAttendanceOpen(false)}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">View By</label>
              <select className="input" value={attendancePeriod} onChange={(e) => setAttendancePeriod(e.target.value as AttendancePeriod)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="label">Reference Date</label>
              <input type="date" className="input" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </div>
            <div className="flex items-end">
              <button className="btn-secondary w-full" onClick={loadAttendance} disabled={attendanceLoading}>
                {attendanceLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <form
            onSubmit={saveAttendanceDay}
            className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Edit Selected Date</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">AM and PM punches are saved separately for the reference date.</div>
              </div>
              <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={loadAttendanceDay} disabled={attendanceDayLoading}>
                {attendanceDayLoading ? 'Loading...' : 'Load Date'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="label">AM Time In</label>
                <input type="time" className="input" value={attendanceDayForm.amTimeIn}
                  onChange={(e) => setAttendanceDayForm({ ...attendanceDayForm, amTimeIn: e.target.value })} />
              </div>
              <div>
                <label className="label">AM Time Out</label>
                <input type="time" className="input" value={attendanceDayForm.amTimeOut}
                  onChange={(e) => setAttendanceDayForm({ ...attendanceDayForm, amTimeOut: e.target.value })} />
              </div>
              <div>
                <label className="label">PM Time In</label>
                <input type="time" className="input" value={attendanceDayForm.pmTimeIn}
                  onChange={(e) => setAttendanceDayForm({ ...attendanceDayForm, pmTimeIn: e.target.value })} />
              </div>
              <div>
                <label className="label">PM Time Out</label>
                <input type="time" className="input" value={attendanceDayForm.pmTimeOut}
                  onChange={(e) => setAttendanceDayForm({ ...attendanceDayForm, pmTimeOut: e.target.value })} />
              </div>
              <div>
                <label className="label">Admin Code</label>
                <input type="password" className="input" value={attendanceDayForm.adminCode}
                  onChange={(e) => setAttendanceDayForm({ ...attendanceDayForm, adminCode: e.target.value })} />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="submit" className="btn-primary" disabled={attendanceDaySaving || attendanceDayLoading}>
                {attendanceDaySaving ? 'Saving...' : 'Save Date'}
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {fmtDate(attendanceRange.from)} to {fmtDate(attendanceRange.to)}
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Hours</div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{fmtHours(attendanceTotalHours)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Late</div>
                <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{attendanceLateMinutes} min</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Undertime</div>
                <div className="text-lg font-bold text-red-700 dark:text-red-300">{attendanceUndertimeMinutes} min</div>
              </div>
            </div>
          </div>

          {attendanceLoading ? (
            <Spinner label="Loading attendance..." />
          ) : attendanceRows.length === 0 ? (
            <EmptyState title="No attendance hours" subtitle="No DTR records found for this employee and period." icon="T" />
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="table-th">Date</th>
                    <th className="table-th">Time In</th>
                    <th className="table-th">Time Out</th>
                    <th className="table-th">Total Hours</th>
                    <th className="table-th">Late</th>
                    <th className="table-th">Undertime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {attendanceRows.map((row) => (
                    <tr key={row.id}>
                      <td className="table-td">{fmtDate(row.date)}</td>
                      <td className="table-td">{fmtTime(row.timeIn)}</td>
                      <td className="table-td">{fmtTime(row.timeOut)}</td>
                      <td className="table-td font-semibold">{fmtHours(row.totalHours)}</td>
                      <td className="table-td">{row.lateMinutes} min</td>
                      <td className="table-td">{row.undertimeMinutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
