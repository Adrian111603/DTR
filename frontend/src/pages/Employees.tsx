import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { Employee, EmploymentStatus, Paginated, Shift } from '../types';
import { Spinner, EmptyState, Pagination, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';

const STATUSES: EmploymentStatus[] = ['REGULAR', 'CONTRACTUAL', 'CASUAL', 'JOB_ORDER', 'COTERMINOUS'];

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
    </div>
  );
}
