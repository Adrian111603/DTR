import { useEffect, useState, useCallback } from 'react';
import { api, apiError } from '../api/client';
import { Device, DeviceStatus } from '../types';
import { Spinner, EmptyState, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';

const empty = { name: '', ipAddress: '', port: 5005, status: 'UNKNOWN' as DeviceStatus };

export default function Devices() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [glogDeviceId, setGlogDeviceId] = useState('');
  const [glogText, setGlogText] = useState('');
  const [importingGlog, setImportingGlog] = useState(false);
  const [syncForm, setSyncForm] = useState({
    deviceId: '',
    password: '12345',
    webPort: 80,
    from: '',
    to: '',
    enrollId: '',
  });
  const [syncingLogs, setSyncingLogs] = useState(false);
  const [testingWeb, setTestingWeb] = useState(false);

  const preferredDevice = devices.find((d) => d.status === 'ONLINE') ?? devices[0];
  const selectedSyncDevice = devices.find((d) => String(d.id) === syncForm.deviceId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/device');
      setDevices(res.data);
    } catch (err) {
      toast(apiError(err, 'Failed to load devices'), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!preferredDevice) return;
    setSyncForm((current) => current.deviceId ? current : { ...current, deviceId: String(preferredDevice.id) });
    setGlogDeviceId((current) => current || String(preferredDevice.id));
  }, [preferredDevice]);

  const openAdd = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (d: Device) => {
    setEditing(d);
    setForm({ name: d.name, ipAddress: d.ipAddress, port: d.port, status: d.status });
    setModalOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, port: Number(form.port) };
      if (editing) {
        await api.put(`/device/${editing.id}`, payload);
        toast('Device updated', 'success');
      } else {
        await api.post('/device', payload);
        toast('Device added', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to save device'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Device) => {
    if (!confirm(`Delete device "${d.name}"?`)) return;
    try {
      await api.delete(`/device/${d.id}`);
      toast('Device deleted', 'success');
      load();
    } catch (err) {
      toast(apiError(err, 'Failed to delete'), 'error');
    }
  };

  const testConnection = async (d: Device) => {
    setTesting(d.id);
    try {
      const res = await api.post('/device/test', {
        id: d.id,
        ipAddress: d.ipAddress,
        port: Number(d.port),
      });
      const target = `${res.data.host}:${res.data.port}`;
      toast(
        res.data.reachable ? `${d.name} is ONLINE at ${target}` : `${d.name} is OFFLINE at ${target}`,
        res.data.reachable ? 'success' : 'error',
      );
      load();
    } catch (err) {
      toast(apiError(err, 'Test failed'), 'error');
    } finally {
      setTesting(null);
    }
  };

  const importGLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!glogText.trim()) return toast('Paste G_Log data first', 'error');

    setImportingGlog(true);
    try {
      const res = await api.post('/device/glog/import', {
        text: glogText,
        deviceId: glogDeviceId ? Number(glogDeviceId) : undefined,
      });
      toast(`Imported ${res.data.imported} log(s), skipped ${res.data.skippedDuplicates} duplicate(s)`, 'success');
      setGlogText('');
    } catch (err) {
      toast(apiError(err, 'Failed to import G_Log'), 'error');
    } finally {
      setImportingGlog(false);
    }
  };

  const syncDeviceLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncForm.deviceId) return toast('Select a device first', 'error');
    if (!syncForm.password.trim()) return toast('Enter the device web password', 'error');

    setSyncingLogs(true);
    try {
      const res = await api.post(`/device/${syncForm.deviceId}/sync-logs`, {
        password: syncForm.password,
        webPort: Number(syncForm.webPort),
        from: syncForm.from || undefined,
        to: syncForm.to || undefined,
        enrollId: syncForm.enrollId || undefined,
      });
      toast(
        `Synced ${res.data.imported} log(s), skipped ${res.data.skippedDuplicates} duplicate(s)`,
        'success',
      );
    } catch (err) {
      toast(apiError(err, 'Failed to sync Log Info'), 'error');
    } finally {
      setSyncingLogs(false);
    }
  };

  const testDeviceWeb = async () => {
    if (!syncForm.deviceId) return toast('Select a device first', 'error');

    setTestingWeb(true);
    try {
      const res = await api.post(`/device/${syncForm.deviceId}/test-web`, {
        password: syncForm.password || undefined,
        webPort: Number(syncForm.webPort),
      });
      const target = `${res.data.host}:${res.data.webPort}`;
      const count = res.data.totalDeviceRecords ?? 0;
      toast(`Device web API is online at ${target}. Found ${count} log(s).`, 'success');
    } catch (err) {
      toast(apiError(err, 'Device web API test failed'), 'error');
    } finally {
      setTestingWeb(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage biometric devices. The receiver endpoint works even without a connected device.
        </p>
        <button className="btn-primary" onClick={openAdd}>+ Add Device</button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner label="Loading devices…" />
        ) : devices.length === 0 ? (
          <EmptyState title="No devices configured" subtitle="Add a biometric device to begin." icon="🖥️" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Name</th>
                  <th className="table-th">Device IP</th>
                  <th className="table-th">Device Port</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Last Check</th>
                  <th className="table-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="table-td font-medium">{d.name}</td>
                    <td className="table-td font-mono">{d.ipAddress}</td>
                    <td className="table-td">{d.port}</td>
                    <td className="table-td"><StatusBadge value={d.status} /></td>
                    <td className="table-td">{d.lastCheck ? new Date(d.lastCheck).toLocaleString() : '—'}</td>
                    <td className="table-td">
                      <div className="flex justify-end gap-2">
                        <button className="btn-secondary px-3 py-1 text-xs" disabled={testing === d.id}
                          onClick={() => testConnection(d)}>
                          {testing === d.id ? 'Testing…' : 'Test'}
                        </button>
                        <button className="btn-secondary px-3 py-1 text-xs" onClick={() => openEdit(d)}>Edit</button>
                        <button className="btn-danger px-3 py-1 text-xs" onClick={() => remove(d)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Device Attendance Endpoint</h3>
        <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
          Devices (or Postman) POST attendance to this endpoint. Works with no device connected.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-green-300">
{`POST /api/device/attendance
{
  "employeeId": "1001",
  "timestamp": "2026-06-09T08:00:00",
  "deviceId": "1",
  "verificationType": "FACE"
}`}
        </pre>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Import G_Log</h3>
        <form onSubmit={importGLog} className="space-y-3">
          <div>
            <label className="label">Source Device</label>
            <select className="input" value={glogDeviceId} onChange={(e) => setGlogDeviceId(e.target.value)}>
              <option value="">No device tag</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name} - {d.ipAddress}:{d.port}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">G_Log Data</label>
            <textarea
              className="input min-h-40 font-mono text-xs"
              value={glogText}
              onChange={(e) => setGlogText(e.target.value)}
              placeholder={`Paste rows from G_Log here, for example:\n11162003  2026-06-09 08:00:00  FACE\n11162003  2026-06-09 17:00:00  FACE`}
            />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" disabled={importingGlog}>
              {importingGlog ? 'Importing...' : 'Import G_Log'}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">Sync Log Info From Device</h3>
        <form onSubmit={syncDeviceLogs} className="space-y-3">
          {selectedSyncDevice && (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Device IP: {selectedSyncDevice.ipAddress} | Web API: {selectedSyncDevice.ipAddress}:{syncForm.webPort}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">Device</label>
              <select
                className="input"
                value={syncForm.deviceId}
                onChange={(e) => setSyncForm({ ...syncForm, deviceId: e.target.value })}
              >
                <option value="">Select device...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} - {d.ipAddress}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Device Web Port</label>
              <input
                type="number"
                className="input"
                value={syncForm.webPort}
                onChange={(e) => setSyncForm({ ...syncForm, webPort: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Device Password</label>
              <input
                type="password"
                className="input"
                value={syncForm.password}
                onChange={(e) => setSyncForm({ ...syncForm, password: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="label">From</label>
              <input
                type="date"
                className="input"
                value={syncForm.from}
                onChange={(e) => setSyncForm({ ...syncForm, from: e.target.value })}
              />
            </div>
            <div>
              <label className="label">To</label>
              <input
                type="date"
                className="input"
                value={syncForm.to}
                onChange={(e) => setSyncForm({ ...syncForm, to: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Employee ID</label>
              <input
                className="input"
                value={syncForm.enrollId}
                onChange={(e) => setSyncForm({ ...syncForm, enrollId: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" disabled={testingWeb || syncingLogs} onClick={testDeviceWeb}>
              {testingWeb ? 'Testing...' : 'Test Web'}
            </button>
            <button className="btn-primary" disabled={syncingLogs}>
              {syncingLogs ? 'Syncing...' : 'Sync Log Info'}
            </button>
          </div>
        </form>
      </div>

      <Modal open={modalOpen} title={editing ? 'Edit Device' : 'Add Device'} onClose={() => setModalOpen(false)}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Device Name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Device IP</label>
              <input className="input" required value={form.ipAddress}
                onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="192.168.254.107" />
            </div>
            <div>
              <label className="label">Device Port</label>
              <input type="number" className="input" required value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DeviceStatus })}>
              <option value="UNKNOWN">UNKNOWN</option>
              <option value="ONLINE">ONLINE</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Add'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
