import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { dateOnly, startOfDay, endOfDay } from '../utils/dtr';
import { syncDtr } from '../utils/dtrSync';

const router = Router();
router.use(authenticate);

// List DTR records with filters: employeeId, from, to + pagination
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

  const where: any = {};
  if (req.query.employeeId) where.employeeId = Number(req.query.employeeId);
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = dateOnly(new Date(String(req.query.from)));
    if (req.query.to) where.date.lte = dateOnly(new Date(String(req.query.to)));
  }

  const [total, data] = await Promise.all([
    prisma.dTR.count({ where }),
    prisma.dTR.findMany({
      where,
      include: { employee: { include: { shift: true } } },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

// Recompute all DTRs for a date range (utility)
router.post('/recompute', async (req, res) => {
  const from = req.body.from ? new Date(req.body.from) : new Date();
  const to = req.body.to ? new Date(req.body.to) : new Date();

  const logs = await prisma.attendance.findMany({
    where: { timestamp: { gte: startOfDay(from), lte: endOfDay(to) } },
    select: { employeeId: true, timestamp: true },
  });

  const seen = new Set<string>();
  for (const l of logs) {
    const key = `${l.employeeId}:${l.timestamp.toDateString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await syncDtr(l.employeeId, l.timestamp);
  }

  res.json({ message: 'Recomputed', count: seen.size });
});

export default router;
