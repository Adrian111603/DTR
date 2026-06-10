import { prisma } from '../prisma';
import { computeDtr, dateOnly, startOfDay, endOfDay } from './dtr';

// Recompute the DTR row for one employee on one day from raw attendance logs.
export async function syncDtr(employeeId: number, day: Date): Promise<void> {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const dtrDate = dateOnly(day);

  const [employee, logs] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    }),
    prisma.attendance.findMany({
      where: { employeeId, timestamp: { gte: dayStart, lte: dayEnd } },
      orderBy: { timestamp: 'asc' },
    }),
  ]);

  if (logs.length === 0) {
    await prisma.dTR.deleteMany({ where: { employeeId, date: dtrDate } });
    return;
  }

  // Device labels can be inconsistent; daily DTR uses first scan as IN and latest scan as OUT.
  const timeIn = logs[0].timestamp;
  const timeOut = logs[logs.length - 1].timestamp;

  const shift = employee?.shift ?? undefined;
  const { totalHours, lateMinutes, undertimeMinutes, overtimeMinutes } = computeDtr(timeIn, timeOut, shift);

  await prisma.dTR.upsert({
    where: { employeeId_date: { employeeId, date: dtrDate } },
    update: { timeIn, timeOut, totalHours, lateMinutes, undertimeMinutes, overtimeMinutes },
    create: { employeeId, date: dtrDate, timeIn, timeOut, totalHours, lateMinutes, undertimeMinutes, overtimeMinutes },
  });
}
