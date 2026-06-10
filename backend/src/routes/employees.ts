import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { syncDtr } from '../utils/dtrSync';

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

router.get('/:id', async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: Number(req.params.id) },
    include: { shift: true },
  });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });
  res.json(employee);
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

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Employee not found' });
  await prisma.employee.delete({ where: { id } });
  res.json({ message: 'Employee deleted' });
});

export default router;
