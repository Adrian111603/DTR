import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { Shift } from '../types';
import { EmptyState, Modal, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';

const empty = {
  name: '',
  amIn: '08:00',
  amOut: '12:00',
  pmIn: '13:00',
  pmOut: '17:00',
  regularDays: 'Monday-Friday',
  saturdayHours: 'Saturday as scheduled',
  overtimeStart: '17:00',
  overtimeEnd: '',
  graceMinutes: 0,
};

export default function Shifts() {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/shifts');
      setShifts(res.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load shifts'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  };

  const openEdit = (shift: Shift) => {
    setEditing(shift);
    setForm({
      name: shift.name,
      amIn: shift.amIn,
      amOut: shift.amOut,
      pmIn: shift.pmIn,
      pmOut: shift.pmOut,
      regularDays: shift.regularDays,
      saturdayHours: shift.saturdayHours ?? '',
      overtimeStart: shift.overtimeStart ?? '',
      overtimeEnd: shift.overtimeEnd ?? '',
      graceMinutes: shift.graceMinutes,
    });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      overtimeStart: form.overtimeStart || null,
      overtimeEnd: form.overtimeEnd || null,
      saturdayHours: form.saturdayHours || null,
      graceMinutes: Number(form.graceMinutes),
    };

    try {
      if (editing) {
        await api.put(`/shifts/${editing.id}`, payload);
        toast('Shift updated and DTR recalculated', 'success');
      } else {
        await api.post('/shifts', payload);
        toast('Shift added', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to save shift'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (shift: Shift) => {
    if (!confirm(`Delete shift "${shift.name}"? Employees using it will return to default hours.`)) return;
    try {
      await api.delete(`/shifts/${shift.id}`);
      toast('Shift deleted', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to delete shift'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Create work schedules used by DTR, undertime, and OT computation.</p>
        <button className="btn-primary" onClick={openAdd}>+ Add Shift</button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading shifts..." />
        ) : shifts.length === 0 ? (
          <EmptyState title="No shifts configured" subtitle="Create a shift to assign employees." icon="S" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">AM</th>
                  <th className="table-th">PM</th>
                  <th className="table-th">OT</th>
                  <th className="table-th">Grace</th>
                  <th className="table-th">Employees</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td className="table-td font-medium">{shift.name}</td>
                    <td className="table-td font-mono">{shift.amIn} - {shift.amOut}</td>
                    <td className="table-td font-mono">{shift.pmIn} - {shift.pmOut}</td>
                    <td className="table-td font-mono">{shift.overtimeStart || '-'} {shift.overtimeEnd ? `- ${shift.overtimeEnd}` : ''}</td>
                    <td className="table-td">{shift.graceMinutes} min</td>
                    <td className="table-td">{shift._count?.employees ?? 0}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => openEdit(shift)}>Edit</button>
                        <button className="btn-danger px-3 py-1 text-xs" onClick={() => remove(shift)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Shift' : 'Add Shift'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Shift Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">AM Arrival</label>
              <input type="time" className="input" required value={form.amIn} onChange={(e) => setForm({ ...form, amIn: e.target.value })} />
            </div>
            <div>
              <label className="label">AM Departure</label>
              <input type="time" className="input" required value={form.amOut} onChange={(e) => setForm({ ...form, amOut: e.target.value })} />
            </div>
            <div>
              <label className="label">PM Arrival</label>
              <input type="time" className="input" required value={form.pmIn} onChange={(e) => setForm({ ...form, pmIn: e.target.value })} />
            </div>
            <div>
              <label className="label">PM Departure</label>
              <input type="time" className="input" required value={form.pmOut} onChange={(e) => setForm({ ...form, pmOut: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">OT Start</label>
              <input type="time" className="input" value={form.overtimeStart} onChange={(e) => setForm({ ...form, overtimeStart: e.target.value })} />
            </div>
            <div>
              <label className="label">OT End</label>
              <input type="time" className="input" value={form.overtimeEnd} onChange={(e) => setForm({ ...form, overtimeEnd: e.target.value })} />
            </div>
            <div>
              <label className="label">Regular Days</label>
              <input className="input" required value={form.regularDays} onChange={(e) => setForm({ ...form, regularDays: e.target.value })} />
            </div>
            <div>
              <label className="label">Grace Minutes</label>
              <input type="number" min={0} className="input" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Saturday Hours</label>
            <input className="input" value={form.saturdayHours} onChange={(e) => setForm({ ...form, saturdayHours: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Shift'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
