// DTR computation helpers.
// Standard schedule: 08:00 in, 17:00 out. Lunch 1hr unpaid.

export const STANDARD_IN_HOUR = 8;
export const STANDARD_IN_MIN = 0;
export const STANDARD_OUT_HOUR = 17;
export const STANDARD_OUT_MIN = 0;
export const LUNCH_HOURS = 1;

export interface ShiftSchedule {
  amIn: string;
  amOut: string;
  pmIn: string;
  pmOut: string;
  overtimeStart?: string | null;
  overtimeEnd?: string | null;
  graceMinutes?: number | null;
}

export interface DtrComputation {
  totalHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
}

const DEFAULT_SHIFT: ShiftSchedule = {
  amIn: '08:00',
  amOut: '12:00',
  pmIn: '13:00',
  pmOut: '17:00',
  graceMinutes: 0,
};

function atClock(base: Date, clock: string): Date {
  const [hour = 0, minute = 0] = clock.split(':').map(Number);
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

function overlapMinutes(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): number {
  const overlapStart = Math.max(start.getTime(), rangeStart.getTime());
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime());
  return Math.max(0, Math.round((overlapEnd - overlapStart) / 60000));
}

export function computeDtr(timeIn: Date | null, timeOut: Date | null, shift: Partial<ShiftSchedule> = {}): DtrComputation {
  if (!timeIn || !timeOut) {
    return { totalHours: 0, lateMinutes: 0, undertimeMinutes: 0, overtimeMinutes: 0 };
  }

  const schedule = { ...DEFAULT_SHIFT, ...shift };
  const expectedIn = atClock(timeIn, schedule.amIn);
  const expectedOut = atClock(timeOut, schedule.pmOut);
  const lunchOut = atClock(timeIn, schedule.amOut);
  const lunchIn = atClock(timeIn, schedule.pmIn);
  const graceMinutes = schedule.graceMinutes ?? 0;

  const lateMinutes = Math.max(0, minutesBetween(expectedIn, timeIn) - graceMinutes);
  const undertimeMinutes = Math.max(0, minutesBetween(timeOut, expectedOut));
  const lunchMinutes = overlapMinutes(timeIn, timeOut, lunchOut, lunchIn);
  const workedMinutes = Math.max(0, minutesBetween(timeIn, timeOut) - lunchMinutes);

  const overtimeStart = schedule.overtimeStart ? atClock(timeOut, schedule.overtimeStart) : expectedOut;
  const overtimeEnd = schedule.overtimeEnd ? atClock(timeOut, schedule.overtimeEnd) : timeOut;
  const overtimeMinutes = overlapMinutes(timeIn, timeOut, overtimeStart, overtimeEnd);
  const totalHours = Math.round((workedMinutes / 60) * 100) / 100;

  return { totalHours, lateMinutes, undertimeMinutes, overtimeMinutes };
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}
