import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';
import { endOfDay, startOfDay } from '../utils/dtr';
import {
  assertAttendanceAdminCode,
  AttendanceSlotName,
  combineDateTime,
  pickSlotLogs,
  slotMeta,
  timeWithinSlot,
} from '../utils/attendanceSlots';

const router = Router();
router.use(authenticate);

const employeeSchema = z.object({
  employeeNumber: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional().nullable(),
  lastName: z.string().min(1),
  department: z.string().min(1),
  position: z.string().min(1),
  status: z.enum(['REGULAR', 'CONTRACTUAL', 'CASUAL', 'JOB_ORDER', 'COTERMINOUS']),
  shiftId: z.coerce.number().int().optional().nullable(),
});

const attendanceDaySchema = z.object({
  date: z.string().min(1),
});

const attendanceDayUpdateSchema = attendanceDaySchema.extend({
  adminCode: z.string().min(1),
  amTimeIn: z.string().optional().nullable(),
  amTimeOut: z.string().optional().nullable(),
  pmTimeIn: z.string().optional().nullable(),
  pmTimeOut: z.string().optional().nullable(),
});

const attendanceSlots: AttendanceSlotName[] = ['amTimeIn', 'amTimeOut', 'pmTimeIn', 'pmTimeOut'];

function clockValue(d?: Date | null) {
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function recomputeEmployeeDtrs(employeeId: number) {
  const logs = await prisma.attendance.findMany({
    where: { employeeId },
    select: { timestamp: true },
  });

  const seen = new Set<string>();
  for (const log of logs) {
    const key = log.timestamp.toDateString();
    if (seen.has(key)) continue;
    seen.add(key);
    await syncDtr(employeeId, log.timestamp);
  }
}

// List with search + pagination
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '10'), 10) || 10));
  const search = String(req.query.search ?? '').trim();

  const where = search
    ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { employeeNumber: { contains: search, mode: 'insensitive' as const } },
          { department: { contains: search, mode: 'insensitive' as const } },
          { position: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [total, data] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { shift: true },
      orderBy: { id: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

router.get('/:id(\\d+)', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: Number(req.params.id) },
    include: { shift: true },
  });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  res.json(employee);
});

router.get('/:id/attendance-day', async (req, res) => {
  const parsed = attendanceDaySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid date' });

  const id = Number(req.params.id);
  const employee = await prisma.employee.findUnique({ where: { id }, include: { shift: true } });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  const day = combineDateTime(parsed.data.date, '00:00');
  const logs = await prisma.attendance.findMany({
    where: { employeeId: id, timestamp: { gte: startOfDay(day), lte: endOfDay(day) } },
    orderBy: { timestamp: 'asc' },
  });
  const slots = pickSlotLogs(logs, employee.shift);

  res.json({
    employee,
    date: parsed.data.date,
    shift: employee.shift,
    amTimeIn: clockValue(slots.amTimeIn?.timestamp),
    amTimeOut: clockValue(slots.amTimeOut?.timestamp),
    pmTimeIn: clockValue(slots.pmTimeIn?.timestamp),
    pmTimeOut: clockValue(slots.pmTimeOut?.timestamp),
  });
});

router.put('/:id/attendance-day', async (req, res) => {
  const parsed = attendanceDayUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  if (!assertAttendanceAdminCode(parsed.data.adminCode)) return res.status(403).json({ message: 'Invalid admin code' });

  const id = Number(req.params.id);
  const employee = await prisma.employee.findUnique({ where: { id }, include: { shift: true } });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  for (const slot of attendanceSlots) {
    const time = parsed.data[slot];
    if (time && !timeWithinSlot(slot, time, employee.shift)) {
      return res.status(400).json({ message: 'Attendance time must be inside the employee shift window.' });
    }
  }

  const day = combineDateTime(parsed.data.date, '00:00');

  await prisma.$transaction(async (tx) => {
    for (const slot of attendanceSlots) {
      const meta = slotMeta(slot, employee.shift);
      const slotStart = combineDateTime(parsed.data.date, meta.start);
      const slotEnd = combineDateTime(parsed.data.date, meta.end);
      await tx.attendance.deleteMany({
        where: {
          employeeId: id,
          eventType: meta.eventType,
          timestamp: { gte: slotStart, lte: slotEnd },
        },
      });

      const time = parsed.data[slot];
      if (time) {
        await tx.attendance.create({
          data: {
            employeeId: id,
            eventType: meta.eventType,
            timestamp: combineDateTime(parsed.data.date, time),
          },
        });
      }
    }
  });

  await syncDtr(id, day);
  res.json({ message: 'Attendance updated' });
});

router.post('/', async (req, res) => {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  const exists = await prisma.employee.findUnique({ where: { employeeNumber: parsed.data.employeeNumber } });
  if (exists) return res.status(409).json({ message: 'Employee number already exists' });

  const employee = await prisma.employee.create({
    data: { ...parsed.data, shiftId: parsed.data.shiftId ?? null },
    include: { shift: true },
  });
  res.status(201).json(employee);
});

router.put('/:id(\\d+)', async (req, res) => {
  const parsed = employeeSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  const id = Number(req.params.id);
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Employee not found' });

  if (parsed.data.employeeNumber && parsed.data.employeeNumber !== existing.employeeNumber) {
    const dup = await prisma.employee.findUnique({ where: { employeeNumber: parsed.data.employeeNumber } });
    if (dup) return res.status(409).json({ message: 'Employee number already exists' });
  }

  const employee = await prisma.employee.update({
    where: { id },
    data: { ...parsed.data, shiftId: parsed.data.shiftId === undefined ? undefined : parsed.data.shiftId },
    include: { shift: true },
  });

  if (parsed.data.shiftId !== undefined && parsed.data.shiftId !== existing.shiftId) {
    await recomputeEmployeeDtrs(id);
  }

  res.json(employee);
});

router.delete('/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Employee not found' });
  await prisma.employee.delete({ where: { id } });
  res.json({ message: 'Employee deleted' });
});

export default router;
