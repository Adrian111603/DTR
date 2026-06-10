import { Request, Response, Router } from 'express';
import net from 'net';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';
import { startOfDay, endOfDay } from '../utils/dtr';

const router = Router();
type AnyRequest = Request & { rawBody?: string };

const deviceSchema = z.object({
  name: z.string().min(1),
  ipAddress: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']).optional(),
});

// Attempt a TCP connection to host:port with a timeout.
function tcpProbe(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

function requesterIpv4(req: Request): string | null {
  const candidates = [req.ip, req.socket.remoteAddress].filter(Boolean) as string[];
  for (const raw of candidates) {
    const cleaned = raw.replace(/^::ffff:/, '');
    const match = cleaned.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    if (!match) continue;

    const parts = match[0].split('.').map(Number);
    if (parts.every((part) => part >= 0 && part <= 255)) return match[0];
  }
  return null;
}

function isLearnableDeviceIp(ip: string): boolean {
  return ip.startsWith('192.168.');
}

export async function learnDeviceSource(req: Request, rawDeviceId?: unknown) {
  const ipAddress = requesterIpv4(req);
  if (!ipAddress || !isLearnableDeviceIp(ipAddress)) return null;

  const parsedDeviceId = rawDeviceId != null ? Number(rawDeviceId) : NaN;
  let device = Number.isInteger(parsedDeviceId)
    ? await prisma.device.findUnique({ where: { id: parsedDeviceId } })
    : null;

  device = device ?? await prisma.device.findFirst({ where: { ipAddress } });

  if (!device) {
    const deviceCount = await prisma.device.count();
    if (deviceCount === 1) device = await prisma.device.findFirst();
  }

  if (!device) return null;

  const updated = await prisma.device.update({
    where: { id: device.id },
    data: { ipAddress, status: 'ONLINE', lastCheck: new Date() },
  });

  if (device.ipAddress !== ipAddress) {
    console.log('[device ip updated]', { deviceId: device.id, from: device.ipAddress, to: ipAddress });
  }

  return updated;
}

const receiverSchema = z.object({
  employeeId: z.string().min(1),
  timestamp: z.string().min(1),
  deviceId: z.union([z.string(), z.number()]).optional(),
  verificationType: z.string().optional(),
});

function firstValue(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] != null && source[key] !== '') return source[key];
  }
  return undefined;
}

function parseRawPairs(raw: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const pair of raw.split(/[&\r\n,;\t]+/)) {
    const match = pair.match(/^\s*([^:=]+)\s*[:=]\s*(.+?)\s*$/);
    if (match) data[match[1].trim()] = decodeURIComponent(match[2].trim());
  }
  return data;
}

function parseTabDelimitedAttendance(raw: string): Record<string, string> {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (/^(GET|POST|PUT|DELETE|HEAD)\s+/i.test(line) || /^[A-Za-z-]+:\s+/.test(line)) continue;
    const parts = line.split(/\t| {2,}/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2 && /^\d+$/.test(parts[0]) && !isNaN(new Date(parts[1]).getTime())) {
      return {
        employeeId: parts[0],
        timestamp: parts[1],
        verificationType: parts[3] ?? parts[2],
      };
    }
  }
  return {};
}

export function normalizeAttendanceText(rawText: string, extraSource: Record<string, unknown> = {}) {
  const messageBody = rawText.includes('\r\n\r\n') ? rawText.split(/\r\n\r\n/).slice(1).join('\r\n\r\n') : rawText;
  const rawPairs = messageBody ? parseRawPairs(messageBody) : {};
  const tabData = messageBody ? parseTabDelimitedAttendance(messageBody) : {};
  const source = { ...tabData, ...rawPairs, ...extraSource };

  const employeeId = firstValue(source, ['employeeId', 'employeeID', 'empId', 'empID', 'userId', 'userID', 'uid', 'PIN', 'pin', 'ID', 'id']);
  const timestamp = firstValue(source, ['timestamp', 'time', 'dateTime', 'datetime', 'punchTime', 'LogTime', 'logTime']);
  const deviceId = firstValue(source, ['deviceId', 'deviceID', 'sn', 'SN', 'serialNumber', 'terminalId']);
  const verificationType = firstValue(source, ['verificationType', 'verifyType', 'verify', 'type', 'mode']);

  return {
    employeeId: employeeId != null ? String(employeeId) : '',
    timestamp: timestamp != null ? String(timestamp) : new Date().toISOString(),
    deviceId,
    verificationType: verificationType != null ? String(verificationType) : undefined,
    rawText,
  };
}

function normalizeAttendancePayload(req: AnyRequest) {
  const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
  const objectBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const rawText = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof body === 'string' ? body : req.rawBody ?? '';
  return normalizeAttendanceText(rawText, { ...objectBody, ...req.query });
}

export async function receiveHeartbeat(req: AnyRequest, res: Response) {
  console.log('[device heartbeat]', {
    ip: req.ip,
    path: req.originalUrl,
    query: req.query,
  });
  await learnDeviceSource(req, firstValue(req.query as Record<string, unknown>, ['deviceId', 'deviceID', 'sn', 'SN', 'terminalId']));
  res.type('text/plain').send('OK');
}

export async function receiveAttendance(req: AnyRequest, res: Response) {
  console.log('[device request]', {
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
    contentType: req.headers['content-type'],
    body: Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body,
    rawBody: req.rawBody,
  });

  const payload = normalizeAttendancePayload(req);
  try {
    const learnedDevice = await learnDeviceSource(req, payload.deviceId);
    if (learnedDevice && !payload.deviceId) payload.deviceId = learnedDevice.id;
    const result = await storeAttendancePayload(payload);
    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(err.statusCode ?? 500).json(err.response ?? { message: 'Failed to receive attendance' });
  }
}

export async function storeAttendancePayload(payload: ReturnType<typeof normalizeAttendanceText>) {
  const parsed = receiverSchema.safeParse(payload);
  if (!parsed.success) {
    const err: any = new Error('Invalid payload');
    err.statusCode = 400;
    err.response = { message: 'Invalid payload', parsed: payload, errors: parsed.error.flatten() };
    throw err;
  }
  const { employeeId, timestamp, deviceId } = parsed.data;

  const employee = await prisma.employee.findUnique({ where: { employeeNumber: employeeId } });
  if (!employee) {
    const err: any = new Error(`No employee with employeeNumber ${employeeId}`);
    err.statusCode = 404;
    err.response = { message: `No employee with employeeNumber ${employeeId}` };
    throw err;
  }

  const ts = new Date(timestamp);
  if (isNaN(ts.getTime())) {
    const err: any = new Error('Invalid timestamp');
    err.statusCode = 400;
    err.response = { message: 'Invalid timestamp' };
    throw err;
  }

  // Auto-determine event type: first punch of the day = TIME_IN, otherwise TIME_OUT
  const existingToday = await prisma.attendance.count({
    where: { employeeId: employee.id, timestamp: { gte: startOfDay(ts), lte: endOfDay(ts) } },
  });
  const eventType = existingToday === 0 ? 'TIME_IN' : 'TIME_OUT';

  const devId = deviceId != null ? Number(deviceId) : null;
  const deviceExists = devId ? await prisma.device.findUnique({ where: { id: devId } }) : null;

  const log = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      timestamp: ts,
      eventType,
      deviceId: deviceExists ? devId : null,
    },
  });

  await syncDtr(employee.id, ts);

  return { message: 'Attendance received', eventType, log };
}

const glogImportSchema = z.object({
  text: z.string().min(1),
  deviceId: z.coerce.number().int().optional(),
});

const deviceLogSyncSchema = z.object({
  password: z.string().min(1),
  webPort: z.coerce.number().int().min(1).max(65535).default(80),
  from: z.string().optional(),
  to: z.string().optional(),
  enrollId: z.coerce.number().int().optional(),
});

const deviceWebTestSchema = z.object({
  password: z.string().optional(),
  webPort: z.coerce.number().int().min(1).max(65535).default(80),
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractDeviceTimestamp(line: string): Date | null {
  const patterns = [
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})[ T,;\t|]+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?\b/i,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})[ T,;\t|]+(\d{1,2}:\d{2}(?::\d{2})?)\s*(AM|PM)?\b/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (!match) continue;

    const dateParts = match[1].replace(/\//g, '-').split('-').map(Number);
    const timeParts = match[2].split(':').map(Number);
    let year: number;
    let month: number;
    let day: number;

    if (dateParts[0] > 999) {
      [year, month, day] = dateParts;
    } else {
      const [a, b, y] = dateParts;
      year = y;
      if (a > 12) {
        day = a;
        month = b;
      } else {
        month = a;
        day = b;
      }
    }

    let [hour, minute, second = 0] = timeParts;
    const meridiem = match[3]?.toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;

    const timestamp = new Date(year, month - 1, day, hour, minute, second, 0);
    if (!isNaN(timestamp.getTime())) return timestamp;
  }

  return null;
}

function lineHasEmployeeNumber(line: string, employeeNumber: string): boolean {
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(employeeNumber)}([^A-Za-z0-9]|$)`);
  return pattern.test(line);
}

async function storeImportedLog(employeeNumber: string, timestamp: Date, deviceId: number | null) {
  const employee = await prisma.employee.findUnique({ where: { employeeNumber } });
  if (!employee) return 'unknown_employee' as const;

  const duplicate = await prisma.attendance.findFirst({
    where: { employeeId: employee.id, timestamp },
  });
  if (duplicate) return 'duplicate' as const;

  const existingToday = await prisma.attendance.count({
    where: {
      employeeId: employee.id,
      timestamp: { gte: startOfDay(timestamp), lte: endOfDay(timestamp) },
    },
  });

  await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      timestamp,
      eventType: existingToday === 0 ? 'TIME_IN' : 'TIME_OUT',
      deviceId,
    },
  });

  await syncDtr(employee.id, timestamp);
  return 'imported' as const;
}

type DeviceLogSyncTarget = {
  id: number;
  ipAddress: string;
};

type DeviceLogSyncOptions = {
  password: string;
  webPort: number;
  from?: string;
  to?: string;
  enrollId?: number;
};

async function postDeviceApi(host: string, webPort: number, body: Record<string, unknown>) {
  const response = await fetch(`http://${host}:${webPort}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Device API returned HTTP ${response.status}`);
  }

  return await response.json() as any;
}

async function fetchDeviceLogs(
  host: string,
  webPort: number,
  password: string,
  filters: { from?: string; to?: string; enrollId?: number },
) {
  const records: any[] = [];
  let index = 0;

  for (let guard = 0; guard < 100; guard++) {
    const payload: Record<string, unknown> = {
      password,
      cmd: 'getlog',
      index,
    };
    if (filters.from) payload.from = filters.from;
    if (filters.to) payload.to = filters.to;
    if (filters.enrollId) payload.enrollid = filters.enrollId;

    const json = await postDeviceApi(host, webPort, payload);
    if (json.result === false) {
      throw new Error(json.msg || 'Device rejected getlog request');
    }

    const batch = Array.isArray(json.record) ? json.record : [];
    records.push(...batch);

    const nextIndex = Number(json.to) + 1;
    const totalCount = Number(json.count);
    if (
      batch.length === 0 ||
      !Number.isFinite(totalCount) ||
      !Number.isFinite(nextIndex) ||
      nextIndex <= index ||
      records.length >= totalCount
    ) break;
    index = nextIndex;
  }

  return records;
}

export async function syncDeviceLogInfo(device: DeviceLogSyncTarget, options: DeviceLogSyncOptions) {
  const records = await fetchDeviceLogs(device.ipAddress, options.webPort, options.password, {
    from: options.from,
    to: options.to,
    enrollId: options.enrollId,
  });

  const rows = records
    .map((record) => {
      const employeeNumber = record.enrollid != null ? String(record.enrollid) : '';
      const timestamp = extractDeviceTimestamp(`${employeeNumber} ${record.time ?? ''}`);
      return { employeeNumber, timestamp };
    })
    .filter((row) => row.employeeNumber && row.timestamp)
    .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());

  let imported = 0;
  let skippedDuplicates = 0;
  let skippedUnknownEmployee = 0;
  const skippedInvalid = records.length - rows.length;

  for (const row of rows) {
    const result = await storeImportedLog(row.employeeNumber, row.timestamp!, device.id);
    if (result === 'imported') imported++;
    if (result === 'duplicate') skippedDuplicates++;
    if (result === 'unknown_employee') skippedUnknownEmployee++;
  }

  await prisma.device.update({
    where: { id: device.id },
    data: { status: 'ONLINE', lastCheck: new Date() },
  });

  return {
    imported,
    skippedDuplicates,
    skippedInvalid,
    skippedUnknownEmployee,
    totalDeviceRecords: records.length,
  };
}

// ---- Public receiver endpoint (no auth so biometric devices can post) ----
router.post('/attendance', receiveAttendance);

// ---- Authenticated device management below ----
router.use(authenticate);

router.get('/', async (_req, res) => {
  const devices = await prisma.device.findMany({ orderBy: { id: 'asc' } });
  res.json(devices);
});

router.post('/', async (req, res) => {
  const parsed = deviceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  const device = await prisma.device.create({ data: { ...parsed.data, status: parsed.data.status ?? 'UNKNOWN' } });
  res.status(201).json(device);
});

router.put('/:id', async (req, res) => {
  const parsed = deviceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const id = Number(req.params.id);
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Device not found' });
  const device = await prisma.device.update({ where: { id }, data: parsed.data });
  res.json(device);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Device not found' });
  await prisma.device.delete({ where: { id } });
  res.json({ message: 'Device deleted' });
});

// Test connection: probe an existing device (by id) or an ad-hoc ip/port
const testSchema = z.object({
  id: z.number().int().optional(),
  ipAddress: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
});

router.post('/test', async (req, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });

  let host = parsed.data.ipAddress;
  let port = parsed.data.port;
  let device = null;

  if (parsed.data.id) {
    device = await prisma.device.findUnique({ where: { id: parsed.data.id } });
    if (!device) return res.status(404).json({ message: 'Device not found' });
    host = host ?? device.ipAddress;
    port = port ?? device.port;
  }

  if (!host || !port) return res.status(400).json({ message: 'ipAddress and port required' });

  const reachable = await tcpProbe(host, port);
  const status = reachable ? 'ONLINE' : 'OFFLINE';

  if (device) {
    device = await prisma.device.update({
      where: { id: device.id },
      data: { status, lastCheck: new Date() },
    });
  }

  res.json({ reachable, status, host, port, device });
});

router.post('/glog/import', async (req, res) => {
  const parsed = glogImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Paste or upload G_Log text first' });

  const employees = await prisma.employee.findMany({
    select: { id: true, employeeNumber: true },
    orderBy: { employeeNumber: 'desc' },
  });
  const employeeList = employees.sort((a, b) => b.employeeNumber.length - a.employeeNumber.length);

  const device = parsed.data.deviceId
    ? await prisma.device.findUnique({ where: { id: parsed.data.deviceId } })
    : null;

  const lines = parsed.data.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows: Array<{ line: string; employeeId: number; timestamp: Date }> = [];
  let skippedInvalid = 0;
  let skippedUnknownEmployee = 0;

  for (const line of lines) {
    const timestamp = extractDeviceTimestamp(line);
    if (!timestamp) {
      skippedInvalid++;
      continue;
    }

    const employee = employeeList.find((emp) => lineHasEmployeeNumber(line, emp.employeeNumber));
    if (!employee) {
      skippedUnknownEmployee++;
      continue;
    }

    rows.push({ line, employeeId: employee.id, timestamp });
  }

  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let imported = 0;
  let skippedDuplicates = 0;

  for (const row of rows) {
    const duplicate = await prisma.attendance.findFirst({
      where: { employeeId: row.employeeId, timestamp: row.timestamp },
    });
    if (duplicate) {
      skippedDuplicates++;
      continue;
    }

    const existingToday = await prisma.attendance.count({
      where: {
        employeeId: row.employeeId,
        timestamp: { gte: startOfDay(row.timestamp), lte: endOfDay(row.timestamp) },
      },
    });

    await prisma.attendance.create({
      data: {
        employeeId: row.employeeId,
        timestamp: row.timestamp,
        eventType: existingToday === 0 ? 'TIME_IN' : 'TIME_OUT',
        deviceId: device ? device.id : null,
      },
    });

    await syncDtr(row.employeeId, row.timestamp);
    imported++;
  }

  res.json({
    imported,
    skippedDuplicates,
    skippedInvalid,
    skippedUnknownEmployee,
    totalLines: lines.length,
  });
});

router.post('/:id/test-web', async (req, res) => {
  const parsed = deviceWebTestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid web port' });

  const device = await prisma.device.findUnique({ where: { id: Number(req.params.id) } });
  if (!device) return res.status(404).json({ message: 'Device not found' });

  const host = device.ipAddress;
  const webPort = parsed.data.webPort;
  const password = parsed.data.password?.trim();

  if (!password) {
    const reachable = await tcpProbe(host, webPort);
    return res.json({ reachable, host, webPort });
  }

  try {
    const json = await postDeviceApi(host, webPort, {
      password,
      cmd: 'getlog',
      index: 0,
    });

    if (json.result === false) {
      return res.status(502).json({
        message: json.msg || 'Device web API rejected the request',
        host,
        webPort,
      });
    }

    res.json({
      reachable: true,
      host,
      webPort,
      totalDeviceRecords: Number(json.count ?? 0),
      batchSize: Array.isArray(json.record) ? json.record.length : 0,
    });
  } catch (err: any) {
    return res.status(502).json({
      message: err.message || 'Failed to reach device web API',
      host,
      webPort,
    });
  }
});

router.post('/:id/sync-logs', async (req, res) => {
  const parsed = deviceLogSyncSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Device password is required' });

  const device = await prisma.device.findUnique({ where: { id: Number(req.params.id) } });
  if (!device) return res.status(404).json({ message: 'Device not found' });

  try {
    const result = await syncDeviceLogInfo(device, {
      password: parsed.data.password,
      webPort: parsed.data.webPort,
      from: parsed.data.from,
      to: parsed.data.to,
      enrollId: parsed.data.enrollId,
    });
    res.json(result);
  } catch (err: any) {
    return res.status(502).json({ message: err.message || 'Failed to read Log Info from device' });
  }
});

export default router;
