import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';
import { startOfDay, endOfDay } from '../utils/dtr';
import {
  assertAttendanceAdminCode,
  buildPunches,
  combineDateTime,
  currentHalfDaySlot,
  localDateKey,
  pickSlotLogs,
  timeWithinSlot,
} from '../utils/attendanceSlots';

const router = Router();
router.use(authenticate);

// Manual entry provides date + optional timeIn/timeOut clock strings.
const manualSchema = z.object({
  employeeId: z.number().int(),
  date: z.string().min(1), // YYYY-MM-DD
  timeIn: z.string().optional().nullable(), // HH:mm
  timeOut: z.string().optional().nullable(),
  amTimeIn: z.string().optional().nullable(),
  amTimeOut: z.string().optional().nullable(),
  pmTimeIn: z.string().optional().nullable(),
  pmTimeOut: z.string().optional().nullable(),
});

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

    const groups = new Map<string, typeof logs>();
    for (const log of logs) {
      const key = `${log.employeeId}:${localDateKey(log.timestamp)}`;
      const existing = groups.get(key) ?? [];
      existing.push(log);
      groups.set(key, existing);
    }

    const data = Array.from(groups.values())
      .flatMap((group) => {
        const timeIn = group.find((log) => log.eventType === 'TIME_IN') ?? group[0];
        const timeOut = [...group].reverse().find((log) => log.eventType === 'TIME_OUT') ?? group[group.length - 1];
        return timeOut.id !== timeIn.id ? [timeIn, timeOut] : [timeIn];
      })
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
  const { employeeId, date, timeIn, timeOut, amTimeIn, amTimeOut, pmTimeIn, pmTimeOut } = parsed.data;

  const punches = buildPunches({
    amTimeIn: amTimeIn ?? timeIn,
    amTimeOut,
    pmTimeIn,
    pmTimeOut: pmTimeOut ?? timeOut,
  });

  if (punches.length === 0) return res.status(400).json({ message: 'Provide at least one attendance time' });

  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { shift: true } });
  if (!emp) return res.status(404).json({ message: 'Employee not found' });

  const today = localDateKey(new Date());
  if (date !== today) {
    return res.status(400).json({ message: 'Attendance manual entry is only allowed for today. Use the employee attendance editor for other dates.' });
  }

  const currentSlot = currentHalfDaySlot(new Date(), emp.shift);
  if (!currentSlot) {
    return res.status(400).json({ message: 'Manual entry is only allowed during the employee AM or PM shift window.' });
  }

  const dayStart = startOfDay(combineDateTime(date, '00:00'));
  const dayEnd = endOfDay(dayStart);
  const existingLogs = await prisma.attendance.findMany({
    where: { employeeId, timestamp: { gte: dayStart, lte: dayEnd } },
    orderBy: { timestamp: 'asc' },
  });
  const slots = pickSlotLogs(existingLogs, emp.shift);
  const allowedSlots =
    currentSlot === 'AM'
      ? slots.amTimeIn && !slots.amTimeOut
        ? ['amTimeOut']
        : !slots.amTimeIn && !slots.amTimeOut
          ? ['amTimeIn', 'amTimeOut']
          : []
      : slots.pmTimeIn && !slots.pmTimeOut
        ? ['pmTimeOut']
        : !slots.pmTimeIn && !slots.pmTimeOut
          ? ['pmTimeIn', 'pmTimeOut']
          : [];

  const invalidPunch = punches.find((punch) => !allowedSlots.includes(punch.slot));
  if (invalidPunch) {
    return res.status(400).json({
      message:
        currentSlot === 'AM'
          ? 'AM manual entry can only add missing AM punches for the current morning shift.'
          : 'PM manual entry can only add missing PM punches for the current afternoon shift.',
    });
  }

  const outOfShift = punches.find((punch) => !timeWithinSlot(punch.slot, punch.time, emp.shift));
  if (outOfShift) {
    return res.status(400).json({ message: 'Manual entry time must be inside the employee shift window.' });
  }

  for (const punch of punches) {
    const eventType = punch.slot.endsWith('TimeIn') ? 'TIME_IN' : 'TIME_OUT';
    await prisma.attendance.create({
      data: { employeeId, timestamp: combineDateTime(date, punch.time), eventType },
    });
  }

  await syncDtr(employeeId, combineDateTime(date, '00:00'));
  res.status(201).json({ message: 'Attendance recorded' });
});

// Edit a single attendance log (change timestamp / eventType)
const editSchema = z.object({
  adminCode: z.string().min(1),
  timestamp: z.string().optional(),
  eventType: z.enum(['TIME_IN', 'TIME_OUT']).optional(),
});

router.put('/:id', async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input' });
  if (!assertAttendanceAdminCode(parsed.data.adminCode)) return res.status(403).json({ message: 'Invalid admin code' });
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
  const adminCode = typeof req.body?.adminCode === 'string' ? req.body.adminCode : String(req.query.adminCode ?? '');
  if (!assertAttendanceAdminCode(adminCode)) return res.status(403).json({ message: 'Invalid admin code' });
  const id = Number(req.params.id);
  const existing = await prisma.attendance.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Attendance log not found' });

  await prisma.attendance.delete({ where: { id } });
  await syncDtr(existing.employeeId, existing.timestamp);
  res.json({ message: 'Attendance deleted' });
});

export default router;
