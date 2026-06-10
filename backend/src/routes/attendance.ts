import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';
import { startOfDay, endOfDay } from '../utils/dtr';

const router = Router();
router.use(authenticate);

// Manual entry provides date + optional timeIn/timeOut clock strings.
const manualSchema = z.object({
  employeeId: z.number().int(),
  date: z.string().min(1), // YYYY-MM-DD
  timeIn: z.string().optional().nullable(), // HH:mm
  timeOut: z.string().optional().nullable(),
});

function combine(dateStr: string, timeStr: string): Date {
  // Build a local Date from YYYY-MM-DD and HH:mm
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// List attendance logs (optional filters: employeeId, date, from, to) + pagination
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
  const dailyOnly = req.query.dailyOnly === 'true' || req.query.dailyOnly === '1';

  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.date) {
    const d = new Date(String(req.query.date));
    where.timestamp = { gte: startOfDay(d), lte: endOfDay(d) };
  } else if (req.query.from || req.query.to) {
    where.timestamp = {};
    if (req.query.from) where.timestamp.gte = startOfDay(new Date(String(req.query.from)));
    if (req.query.to) where.timestamp.lte = endOfDay(new Date(String(req.query.to)));
  }

  if (dailyOnly) {
    const logs = await prisma.attendance.findMany({
      where,
      include: { employee: true, device: true },
      orderBy: [{ employeeId: 'asc' }, { timestamp: 'asc' }],
    });

    const groups = new Map<string, { timeIn: any; timeOut?: any }>();
    for (const log of logs) {
      const key = `${log.employeeId}:${localDateKey(log.timestamp)}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { timeIn: { ...log, eventType: 'TIME_IN' } });
      } else {
        existing.timeOut = { ...log, eventType: 'TIME_OUT' };
      }
    }

    const data = Array.from(groups.values())
      .flatMap((group) => group.timeOut && group.timeOut.id !== group.timeIn.id
        ? [group.timeIn, group.timeOut]
        : [group.timeIn])
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = data.length;
    const start = (page - 1) * pageSize;
    return res.json({
      data: data.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  }

  const [total, data] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: { employee: true, device: true },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// Create manual attendance (creates TIME_IN and/or TIME_OUT logs for the day)
router.post('/', async (req, res) => {
  const parsed = manualSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  const { employeeId, date, timeIn, timeOut } = parsed.data;

  if (!timeIn && !timeOut) return res.status(400).json({ message: 'Provide at least Time In or Time Out' });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });

  if (timeIn) {
    await prisma.attendance.create({
      data: { employeeId, timestamp: combine(date, timeIn), eventType: 'TIME_IN' },
    });
  }
  if (timeOut) {
    await prisma.attendance.create({
      data: { employeeId, timestamp: combine(date, timeOut), eventType: 'TIME_OUT' },
    });
  }

  await syncDtr(employeeId, new Date(date));
  res.status(201).json({ message: 'Attendance recorded' });
});

// Edit a single attendance log (change timestamp / eventType)
const editSchema = z.object({
  timestamp: z.string().optional(),
  eventType: z.enum(['TIME_IN', 'TIME_OUT']).optional(),
});

router.put('/:id', async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  const id = Number(req.params.id);

  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Attendance log not found' });

  const updated = await prisma.attendance.update({
    where: { id },
    data: {
      timestamp: parsed.data.timestamp ? new Date(parsed.data.timestamp) : undefined,
      eventType: parsed.data.eventType,
    },
  });

  await syncDtr(updated.employeeId, updated.timestamp);
  if (existing.timestamp.toDateString() !== updated.timestamp.toDateString()) {
    await syncDtr(existing.employeeId, existing.timestamp);
  }
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Attendance log not found' });

  await prisma.attendance.delete({ where: { id } });
  await syncDtr(existing.employeeId, existing.timestamp);
  res.json({ message: 'Attendance deleted' });
});

export default router;
