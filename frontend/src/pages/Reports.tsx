import { useEffect, useState } from 'react';
import { api, apiError } from '../api/client';
import { Employee } from '../types';
import { Spinner, EmptyState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';

type ReportType = 'daily' | 'weekly' | 'monthly';
type PaperSize = 'letter' | 'long';
type CopyMode = '1' | '2';
type SingleSide = 'left' | 'right';

interface Row {
  employeeNumber: string;
  name: string;
  department: string;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
}

interface FormDay {
  day: number;
  date: string;
  amArrival?: string | null;
  amDeparture?: string | null;
  pmArrival?: string | null;
  pmDeparture?: string | null;
  undertimeHours: number;
  undertimeMinutes: number;
  overtimeHours: number;
  overtimeMinutes: number;
}

interface MonthlyFormData {
  employee: Employee;
  month: string;
  shift: {
    name: string;
    amIn: string;
    amOut: string;
    pmIn: string;
    pmOut: string;
    regularDays: string;
    saturdayHours?: string | null;
  };
  days: FormDay[];
}

interface DtrFormProps {
  formData: MonthlyFormData;
  employeeName: string;
  officeName: string;
  formTitle: string;
  signatory: string;
  signatoryTitle: string;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(v?: string | null) {
  if (!v) return '';
  return new Date(v).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtMinutes(v: number) {
  const h = Math.floor(v / 60);
  const m = v % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function DtrForm({ formData, employeeName, officeName, formTitle, signatory, signatoryTitle }: DtrFormProps) {
  return (
    <section className="dtr-sheet-form">
      <div className="dtr-service-no">SERVICE FORM No. 48</div>
      <div className="dtr-main-title">{formTitle}</div>
      <div className="dtr-name-line">{employeeName}</div>
      <div className="dtr-small-center">(Name)</div>

      <div className="dtr-meta-grid">
        <div>For the month of</div>
        <div className="dtr-fill-line">{formData.month}</div>
        <div>Office / Unit</div>
        <div className="dtr-fill-line">{officeName}</div>
      </div>

      <div className="dtr-hours-grid">
        <div>Official hours for arrival and departure</div>
        <div>
          <div>Regular days: {formData.shift.amIn}-{formData.shift.amOut}, {formData.shift.pmIn}-{formData.shift.pmOut}</div>
          <div>Saturdays: {formData.shift.saturdayHours || '-'}</div>
        </div>
      </div>

      <table className="dtr-form-table">
        <thead>
          <tr>
            <th rowSpan={2}>Day</th>
            <th colSpan={2}>A.M.</th>
            <th colSpan={2}>P.M.</th>
            <th colSpan={2}>UNDERTIME</th>
            <th colSpan={2}>OT</th>
          </tr>
          <tr>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Hours</th>
            <th>Minutes</th>
            <th>Hours</th>
            <th>Minutes</th>
          </tr>
        </thead>
        <tbody>
          {formData.days.map((day) => (
            <tr key={day.day}>
              <td className="text-center">{day.day}</td>
              <td>{fmtTime(day.amArrival)}</td>
              <td>{fmtTime(day.amDeparture)}</td>
              <td>{fmtTime(day.pmArrival)}</td>
              <td>{fmtTime(day.pmDeparture)}</td>
              <td className="text-center">{day.undertimeHours || ''}</td>
              <td className="text-center">{day.undertimeMinutes || ''}</td>
              <td className="text-center">{day.overtimeHours || ''}</td>
              <td className="text-center">{day.overtimeMinutes || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="dtr-certification">
        I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.
      </div>

      <div className="dtr-verify">
        <div className="dtr-sign-line">&nbsp;</div>
        <div>Verified as to the prescribed office hours.</div>
      </div>

      <div className="dtr-signatory">
        <div className="dtr-sign-line dtr-sign-name">{signatory}</div>
        <div>{signatoryTitle}</div>
      </div>
    </section>
  );
}

function BlankHalf() {
  return <div className="dtr-blank-half" aria-hidden="true" />;
}

export default function Reports() {
  const { toast } = useToast();
  const { settings, updateSettings } = useSettings();
  const [type, setType] = useState<ReportType>('daily');
  const [date, setDate] = useState(todayStr());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');

  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [rightEmployeeId, setRightEmployeeId] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formLoading, setFormLoading] = useState(false);
  const [formData, setFormData] = useState<MonthlyFormData | null>(null);
  const [rightFormData, setRightFormData] = useState<MonthlyFormData | null>(null);
  const [officeName, setOfficeName] = useState('ERAMS');
  const [formTitle, setFormTitle] = useState('DAILY TIME RECORD');
  const [signatory, setSignatory] = useState('TETO C. PILAR');
  const [signatoryTitle, setSignatoryTitle] = useState('In Charge');
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [copyMode, setCopyMode] = useState<CopyMode>('2');
  const [singleSide, setSingleSide] = useState<SingleSide>('left');

  useEffect(() => {
    const id = 'dtr-print-page-size';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${paperSize === 'long' ? '8.5in 13in' : 'letter'} portrait; margin: 0; }`;

    return () => {
      style?.remove();
    };
  }, [paperSize]);

  useEffect(() => {
    api.get('/employees', { params: { pageSize: 100 } })
      .then((r) => {
        setEmployees(r.data.data);
        if (r.data.data[0]) setFormEmployeeId(String(r.data.data[0].id));
      })
      .catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reports/${type}`, { params: date ? { date } : {} });
      setRows(res.data.rows);
      toast(`${res.data.count} record(s) found`, 'info');
    } catch (err) {
      toast(apiError(err, 'Failed to generate report'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyForm = async (employeeId: string) => {
    const res = await api.get('/reports/monthly-form/data', {
      params: { employeeId, date: formDate },
    });
    return res.data as MonthlyFormData;
  };

  const loadMonthlyForm = async () => {
    if (!formEmployeeId) return toast('Select an employee first', 'error');
    setFormLoading(true);
    try {
      const [leftData, rightData] = await Promise.all([
        fetchMonthlyForm(formEmployeeId),
        rightEmployeeId ? fetchMonthlyForm(rightEmployeeId) : Promise.resolve(null),
      ]);
      setFormData(leftData);
      setRightFormData(rightData);
      toast(rightData ? 'Two DTR forms loaded' : 'Monthly DTR form loaded', 'success');
    } catch (err) {
      toast(apiError(err, 'Failed to load DTR form'), 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const download = async (format: 'pdf' | 'excel') => {
    setDownloading(format);
    try {
      const res = await api.get(`/reports/${type}/${format}`, {
        params: { ...(date ? { date } : {}), title: settings.appName },
        responseType: 'blob',
      });
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `dtr-${type}-report.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast(`${format.toUpperCase()} downloaded`, 'success');
    } catch (err) {
      toast(apiError(err, 'Download failed'), 'error');
    } finally {
      setDownloading('');
    }
  };

  const employeeName = (data: MonthlyFormData) =>
    `${data.employee.lastName}, ${data.employee.firstName} ${data.employee.middleName ?? ''}`.trim();

  const renderHalf = (side: SingleSide) => {
    if (!formData) return <BlankHalf />;
    if (copyMode === '2' || singleSide === side) {
      const data = side === 'right' ? (rightFormData ?? formData) : formData;
      return (
        <DtrForm
          formData={data}
          employeeName={employeeName(data)}
          officeName={officeName}
          formTitle={formTitle}
          signatory={signatory}
          signatoryTitle={signatoryTitle}
        />
      );
    }
    return <BlankHalf />;
  };

  return (
    <div className="space-y-4">
      <div className="card no-print flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Report Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div>
          <label className="label">Reference Date</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary" onClick={() => download('pdf')} disabled={!!downloading}>
            {downloading === 'pdf' ? 'Exporting...' : 'PDF'}
          </button>
          <button className="btn-secondary" onClick={() => download('excel')} disabled={!!downloading}>
            {downloading === 'excel' ? 'Exporting...' : 'Excel'}
          </button>
        </div>
      </div>

      <div className="card no-print">
        {loading ? (
          <Spinner label="Generating report..." />
        ) : rows === null ? (
          <EmptyState title="No summary generated yet" subtitle="Choose a type and click Generate." icon="P" />
        ) : rows.length === 0 ? (
          <EmptyState title="No records for this period" icon="P" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="table-th">Emp No</th>
                  <th className="table-th">Name</th>
                  <th className="table-th">Department</th>
                  <th className="table-th">Date</th>
                  <th className="table-th">In</th>
                  <th className="table-th">Out</th>
                  <th className="table-th">Hrs</th>
                  <th className="table-th">Late</th>
                  <th className="table-th">Undertime</th>
                  <th className="table-th">OT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="table-td font-mono">{r.employeeNumber}</td>
                    <td className="table-td font-medium">{r.name}</td>
                    <td className="table-td">{r.department}</td>
                    <td className="table-td">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="table-td">{fmtTime(r.timeIn)}</td>
                    <td className="table-td">{fmtTime(r.timeOut)}</td>
                    <td className="table-td font-semibold">{r.totalHours.toFixed(2)}</td>
                    <td className="table-td">{fmtMinutes(r.lateMinutes)}</td>
                    <td className="table-td">{fmtMinutes(r.undertimeMinutes)}</td>
                    <td className="table-td">{fmtMinutes(r.overtimeMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card no-print space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">System Name</label>
            <input className="input" value={settings.appName} onChange={(e) => updateSettings({ appName: e.target.value })} />
          </div>
          <div>
            <label className="label">System Subtitle</label>
            <input className="input" value={settings.appSubtitle} onChange={(e) => updateSettings({ appSubtitle: e.target.value })} />
          </div>
          <div>
            <label className="label">Logo Text</label>
            <input className="input" value={settings.logoText} maxLength={6} onChange={(e) => updateSettings({ logoText: e.target.value.toUpperCase() })} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Left Employee</label>
            <select className="input" value={formEmployeeId} onChange={(e) => setFormEmployeeId(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.lastName}, {emp.firstName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Right Employee</label>
            <select className="input" value={rightEmployeeId} onChange={(e) => setRightEmployeeId(e.target.value)}>
              <option value="">Same as left</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employeeNumber} - {emp.lastName}, {emp.firstName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Office / Unit</label>
            <input className="input" value={officeName} onChange={(e) => setOfficeName(e.target.value)} />
          </div>
          <div>
            <label className="label">Form Title</label>
            <input className="input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={loadMonthlyForm} disabled={formLoading}>
            {formLoading ? 'Loading...' : 'Load DTR Form'}
          </button>
          <button className="btn-secondary" onClick={() => window.print()} disabled={!formData}>Print</button>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="label">Paper Size</label>
            <select className="input" value={paperSize} onChange={(e) => setPaperSize(e.target.value as PaperSize)}>
              <option value="letter">Letter 8.5 x 11</option>
              <option value="long">Long 8.5 x 13</option>
            </select>
          </div>
          <div>
            <label className="label">Forms Per Page</label>
            <select className="input" value={copyMode} onChange={(e) => setCopyMode(e.target.value as CopyMode)}>
              <option value="2">2 forms</option>
              <option value="1">1 form</option>
            </select>
          </div>
          <div>
            <label className="label">Single Form Side</label>
            <select className="input" value={singleSide} onChange={(e) => setSingleSide(e.target.value as SingleSide)} disabled={copyMode === '2'}>
              <option value="left">Left half</option>
              <option value="right">Right half</option>
            </select>
          </div>
          <div>
            <label className="label">Signatory Name</label>
            <input className="input" value={signatory} onChange={(e) => setSignatory(e.target.value)} />
          </div>
          <div>
            <label className="label">Signatory Title</label>
            <input className="input" value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} />
          </div>
        </div>
      </div>

      {formData && (
        <div className="dtr-paper-scroll">
          <div className={`dtr-paper dtr-paper--${paperSize}`}>
            <div className="dtr-sheet-grid">
              <div className="dtr-half dtr-half-left">{renderHalf('left')}</div>
              <div className="dtr-half dtr-half-right">{renderHalf('right')}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
