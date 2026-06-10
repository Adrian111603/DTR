import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';

const router = Router();
router.use(authenticate);

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format');

const shiftSchema = z.object({
  name: z.string().min(1),
  amIn: timeSchema.default('08:00'),
  amOut: timeSchema.default('12:00'),
  pmIn: timeSchema.default('13:00'),
  pmOut: timeSchema.default('17:00'),
  regularDays: z.string().min(1).default('Monday-Friday'),
  saturdayHours: z.string().optional().nullable(),
  overtimeStart: timeSchema.optional().nullable(),
  overtimeEnd: timeSchema.optional().nullable(),
  graceMinutes: z.coerce.number().int().min(0).default(0),
});

async function recomputeShiftDtrs(shiftId: number) {
  const logs = await prisma.attendance.findMany({
    where: { employee: { shiftId } },
    select: { employeeId: true, timestamp: true },
  });

  const seen = new Set<string>();
  for (const log of logs) {
    const key = `${log.employeeId}:${log.timestamp.toDateString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncDtr(log.employeeId, log.timestamp);
  }
}

router.get('/', async (_req, res) => {
  const shifts = await prisma.shift.findMany({
    orderBy: { id: 'asc' },
    include: { _count: { select: { employees: true } } },
  });
  res.json(shifts);
});

router.post('/', async (req, res) => {
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  const existing = await prisma.shift.findUnique({ where: { name: parsed.data.name } });
  if (existing) return res.status(409).json({ message: 'Shift name already exists' });

  const shift = await prisma.shift.create({ data: parsed.data });
  res.status(201).json(shift);
});

router.put('/:id', async (req, res) => {
  const parsed = shiftSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  const id = Number(req.params.id);
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Shift not found' });

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const duplicate = await prisma.shift.findUnique({ where: { name: parsed.data.name } });
    if (duplicate) return res.status(409).json({ message: 'Shift name already exists' });
  }

  const shift = await prisma.shift.update({ where: { id }, data: parsed.data });
  await recomputeShiftDtrs(id);
  res.json(shift);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.shift.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Shift not found' });

  await prisma.shift.delete({ where: { id } });
  res.json({ message: 'Shift deleted' });
});

export default router;
