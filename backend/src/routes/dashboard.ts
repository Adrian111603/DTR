import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticate } from '../middleware/auth';
import { startOfDay, endOfDay } from '../utils/dtr';

const router = Router();
router.use(authenticate);

router.get('/stats', async (_req, res) => {
  const now = new Date();
  const dayStart = startOfDay(now);

  const totalEmployees = await prisma.employee.count();

  const todays = await prisma.dTR.findMany({
    where: { date: dayStart },
  });

  const presentToday = todays.length;
  const lateToday = todays.filter((d) => d.lateMinutes > 0).length;
  const absentToday = Math.max(0, totalEmployees - presentToday);

  const recentLogs = await prisma.attendance.findMany({
    include: { employee: true, device: true },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  res.json({ totalEmployees, presentToday, absentToday, lateToday, recentLogs });
});

// Weekly attendance: present count per day for the last 7 days
router.get('/weekly', async (_req, res) => {
  const result: { label: string; present: number; late: number }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const ds = startOfDay(day);

    const rows = await prisma.dTR.findMany({ where: { date: ds } });
    result.push({
      label: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      present: rows.length,
      late: rows.filter((r) => r.lateMinutes > 0).length,
    });
  }

  res.json(result);
});

// Monthly attendance: present count per day for the current month
router.get('/monthly', async (_req, res) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthStart = startOfDay(new Date(year, month, 1));
  const monthEnd = endOfDay(new Date(year, month, daysInMonth));

  const rows = await prisma.dTR.findMany({
    where: { date: { gte: monthStart, lte: monthEnd } },
    select: { date: true, lateMinutes: true },
  });

  const buckets: Record<number, { present: number; late: number }> = {};
  for (let d = 1; d <= daysInMonth; d++) buckets[d] = { present: 0, late: 0 };
  for (const r of rows) {
    const d = new Date(r.date).getDate();
    buckets[d].present += 1;
    if (r.lateMinutes > 0) buckets[d].late += 1;
  }

  const result = Object.entries(buckets).map(([day, v]) => ({
    label: String(day),
    present: v.present,
    late: v.late,
  }));

  res.json(result);
});

export default router;
