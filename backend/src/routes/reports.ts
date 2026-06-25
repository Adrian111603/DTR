import { Router } from 'express';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { startOfDay, endOfDay } from '../utils/dtr';

const router = Router();
router.use(authenticate);

type RangeType = 'daily' | 'weekly' | 'monthly';

function resolveRange(type: RangeType, dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  let from: Date;
  let to: Date;

  if (type === 'daily') {
    from = startOfDay(base);
    to = endOfDay(base);
  } else if (type === 'weekly') {
    const day = base.getDay(); // 0 Sun .. 6 Sat
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((day + 6) % 7));
    from = startOfDay(monday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    to = endOfDay(sunday);
  } else {
    from = startOfDay(new Date(base.getFullYear(), base.getMonth(), 1));
    to = endOfDay(new Date(base.getFullYear(), base.getMonth() + 1, 0));
  }
  return { from, to };
}

async function fetchRows(type: RangeType, dateStr?: string, employeeId?: number) {
  const { from, to } = resolveRange(type, dateStr);
  const where: any = { date: { gte: from, lte: to } };
  if (employeeId) where.employeeId = employeeId;

  const rows = await prisma.dTR.findMany({
    where,
    include: { employee: { include: { shift: true } } },
    orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
  });
  return { rows, from, to };
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function minutesParts(total: number) {
  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  };
}

function minutesFromClock(clock: string): number {
  const [hour = 0, minute = 0] = clock.split(':').map(Number);
  return (hour * 60) + minute;
}

function fmtTime(d: Date | null): string {
  if (!d) return '--';
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function reportTitle(req: any): string {
  const raw = req.query.title ? String(req.query.title) : '';
  return raw.trim() || 'DTR Management System';
}

router.get('/monthly-form/data', async (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  if (!employeeId) return res.status(400).json({ message: 'Select an employee first' });

  const base = req.query.date ? new Date(String(req.query.date)) : new Date();
  const year = base.getFullYear();
  const month = base.getMonth();
  const from = startOfDay(new Date(year, month, 1));
  const to = endOfDay(new Date(year, month + 1, 0));
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { shift: true },
  });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  const [dtrs, logs] = await Promise.all([
    prisma.dTR.findMany({
      where: { employeeId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { employeeId, timestamp: { gte: from, lte: to } },
      orderBy: { timestamp: 'asc' },
    }),
  ]);

  const dtrByDate = new Map(dtrs.map((dtr) => [localDateKey(dtr.date), dtr]));
  const logsByDate = new Map<string, typeof logs>();
  for (const log of logs) {
    const key = localDateKey(log.timestamp);
    const list = logsByDate.get(key) ?? [];
    list.push(log);
    logsByDate.set(key, list);
  }

  const days = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = localDateKey(date);
    const dayLogs = logsByDate.get(key) ?? [];
    const dtr = dtrByDate.get(key);
    const undertime = minutesParts(dtr?.undertimeMinutes ?? 0);
    const overtime = minutesParts(dtr?.overtimeMinutes ?? 0);
    const shift = employee.shift ?? {
      amIn: '08:00',
      amOut: '12:00',
      pmIn: '13:00',
      pmOut: '17:00',
    };
    const noonCutoff = Math.floor((minutesFromClock(shift.amOut) + minutesFromClock(shift.pmIn)) / 2);
    const amLogs = dayLogs.filter((log) => {
      const timestamp = new Date(log.timestamp);
      return ((timestamp.getHours() * 60) + timestamp.getMinutes()) < noonCutoff;
    });
    const pmLogs = dayLogs.filter((log) => {
      const timestamp = new Date(log.timestamp);
      return ((timestamp.getHours() * 60) + timestamp.getMinutes()) >= noonCutoff;
    });
    const amIn = amLogs.find((log) => log.eventType === 'TIME_IN') ?? amLogs[0] ?? null;
    const amOut = [...amLogs].reverse().find((log) => log.eventType === 'TIME_OUT') ?? (amLogs.length > 1 ? amLogs[amLogs.length - 1] : null);
    const pmIn = pmLogs.find((log) => log.eventType === 'TIME_IN') ?? (pmLogs.length > 1 ? pmLogs[0] : null);
    const pmOut = [...pmLogs].reverse().find((log) => log.eventType === 'TIME_OUT') ?? pmLogs[pmLogs.length - 1] ?? null;

    days.push({
      day,
      date: key,
      amArrival: amIn?.timestamp ?? null,
      amDeparture: amOut?.timestamp ?? null,
      pmArrival: pmIn?.timestamp ?? null,
      pmDeparture: pmOut?.timestamp ?? null,
      undertimeHours: undertime.hours,
      undertimeMinutes: undertime.minutes,
      overtimeHours: overtime.hours,
      overtimeMinutes: overtime.minutes,
      totalHours: dtr?.totalHours ?? 0,
    });
  }

  res.json({
    employee,
    month: base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    from,
    to,
    shift: employee.shift ?? {
      name: 'Default Office Hours',
      amIn: '08:00',
      amOut: '12:00',
      pmIn: '13:00',
      pmOut: '17:00',
      regularDays: 'Monday-Friday',
      saturdayHours: null,
      overtimeStart: null,
      overtimeEnd: null,
      graceMinutes: 0,
    },
    days,
  });
});

// JSON report
router.get('/:type', async (req, res) => {
  const type = req.params.type as RangeType;
  if (!['daily', 'weekly', 'monthly'].includes(type)) return res.status(400).json({ message: 'Invalid report type' });
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const { rows, from, to } = await fetchRows(type, req.query.date as string, employeeId);

  res.json({
    type,
    from,
    to,
    count: rows.length,
    rows: rows.map((r) => ({
      employeeNumber: r.employee.employeeNumber,
      name: `${r.employee.lastName}, ${r.employee.firstName}`,
      department: r.employee.department,
      date: r.date,
      timeIn: r.timeIn,
      timeOut: r.timeOut,
      totalHours: r.totalHours,
      lateMinutes: r.lateMinutes,
      undertimeMinutes: r.undertimeMinutes,
      overtimeMinutes: r.overtimeMinutes,
      shift: r.employee.shift,
    })),
  });
});

// Excel export
router.get('/:type/excel', async (req, res) => {
  const type = req.params.type as RangeType;
  if (!['daily', 'weekly', 'monthly'].includes(type)) return res.status(400).json({ message: 'Invalid report type' });
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const title = reportTitle(req);
  const { rows, from, to } = await fetchRows(type, req.query.date as string, employeeId);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('DTR Report');

  ws.mergeCells('A1:H1');
  ws.getCell('A1').value = `${title} - ${type.toUpperCase()} REPORT`;
  ws.getCell('A1').font = { size: 14, bold: true };
  ws.mergeCells('A2:H2');
  ws.getCell('A2').value = `Period: ${fmtDate(from)} to ${fmtDate(to)}`;

  ws.addRow([]);
  const header = ws.addRow([
    'Emp No', 'Name', 'Department', 'Date', 'Time In', 'Time Out', 'Total Hrs', 'Late (min)',
  ]);
  header.font = { bold: true };
  header.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  for (const r of rows) {
    ws.addRow([
      r.employee.employeeNumber,
      `${r.employee.lastName}, ${r.employee.firstName}`,
      r.employee.department,
      fmtDate(r.date),
      fmtTime(r.timeIn),
      fmtTime(r.timeOut),
      r.totalHours,
      r.lateMinutes,
    ]);
  }

  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = max + 2;
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="dtr-${type}-report.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// PDF export
router.get('/:type/pdf', async (req, res) => {
  const type = req.params.type as RangeType;
  if (!['daily', 'weekly', 'monthly'].includes(type)) return res.status(400).json({ message: 'Invalid report type' });
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const title = reportTitle(req);
  const { rows, from, to } = await fetchRows(type, req.query.date as string, employeeId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="dtr-${type}-report.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40, layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(16).fillColor('#1E3A8A').text(title, { align: 'center' });
  doc.fontSize(12).fillColor('#000').text(`${type.toUpperCase()} REPORT`, { align: 'center' });
  doc.fontSize(9).fillColor('#555').text(`Period: ${fmtDate(from)} to ${fmtDate(to)}`, { align: 'center' });
  doc.moveDown(1);

  const cols = [
    { label: 'Emp No', width: 55 },
    { label: 'Name', width: 150 },
    { label: 'Department', width: 150 },
    { label: 'Date', width: 90 },
    { label: 'In', width: 65 },
    { label: 'Out', width: 65 },
    { label: 'Hrs', width: 45 },
    { label: 'Late', width: 45 },
  ];

  const startX = doc.x;
  let y = doc.y;

  const drawRow = (values: string[], bold = false, bg?: string) => {
    let x = startX;
    const rowHeight = 18;
    if (bg) {
      const totalWidth = cols.reduce((s, c) => s + c.width, 0);
      doc.rect(x, y, totalWidth, rowHeight).fill(bg);
    }
    doc.fillColor(bold ? '#fff' : '#000').fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica');
    for (let i = 0; i < cols.length; i++) {
      doc.text(values[i] ?? '', x + 3, y + 5, { width: cols[i].width - 6, ellipsis: true });
      x += cols[i].width;
    }
    y += rowHeight;
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = doc.y;
    }
  };

  drawRow(cols.map((c) => c.label), true, '#1E3A8A');
  if (rows.length === 0) {
    doc.fillColor('#666').fontSize(10).text('No records for this period.', startX, y + 8);
  } else {
    for (const r of rows) {
      drawRow([
        r.employee.employeeNumber,
        `${r.employee.lastName}, ${r.employee.firstName}`,
        r.employee.department,
        fmtDate(r.date),
        fmtTime(r.timeIn),
        fmtTime(r.timeOut),
        String(r.totalHours),
        String(r.lateMinutes),
      ]);
    }
  }

  doc.end();
});

export default router;
