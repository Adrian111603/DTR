import fs from 'fs';
import path from 'path';
import { Attendance, EventType, Shift } from '@prisma/client';

export type AttendanceSlotName = 'amTimeIn' | 'amTimeOut' | 'pmTimeIn' | 'pmTimeOut';

export type SlotValues = Partial<Record<AttendanceSlotName, string | null>>;

export const DEFAULT_SHIFT = {
  amIn: '08:00',
  amOut: '12:00',
  pmIn: '13:00',
  pmOut: '17:00',
};

const adminCodeFile =
  process.env.ADMIN_ATTENDANCE_CODE_FILE || path.join(process.cwd(), 'data', 'attendance-admin-code.json');

type ShiftLike = Pick<Shift, 'amIn' | 'amOut' | 'pmIn' | 'pmOut'> | null | undefined;

export function attendanceAdminCode() {
  try {
    if (fs.existsSync(adminCodeFile)) {
      const raw = JSON.parse(fs.readFileSync(adminCodeFile, 'utf8')) as { code?: string };
      if (raw.code) return raw.code;
    }
  } catch {
    // Fall through to the configured/default code.
  }

  return process.env.ADMIN_ATTENDANCE_CODE || 'admin123';
}

export function assertAttendanceAdminCode(code: string | null | undefined) {
  return Boolean(code && code === attendanceAdminCode());
}

export function updateAttendanceAdminCode(code: string) {
  fs.mkdirSync(path.dirname(adminCodeFile), { recursive: true });
  fs.writeFileSync(adminCodeFile, JSON.stringify({ code }, null, 2));
}

export function shiftClock(shift: ShiftLike) {
  return {
    amIn: shift?.amIn ?? DEFAULT_SHIFT.amIn,
    amOut: shift?.amOut ?? DEFAULT_SHIFT.amOut,
    pmIn: shift?.pmIn ?? DEFAULT_SHIFT.pmIn,
    pmOut: shift?.pmOut ?? DEFAULT_SHIFT.pmOut,
  };
}

export function combineDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function minutesFromClock(clock: string) {
  const [hour = 0, minute = 0] = clock.split(':').map(Number);
  return hour * 60 + minute;
}

export function minutesFromDate(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function slotMeta(slot: AttendanceSlotName, shift: ShiftLike) {
  const clock = shiftClock(shift);
  if (slot === 'amTimeIn') return { eventType: 'TIME_IN' as EventType, start: clock.amIn, end: clock.amOut };
  if (slot === 'amTimeOut') return { eventType: 'TIME_OUT' as EventType, start: clock.amIn, end: clock.amOut };
  if (slot === 'pmTimeIn') return { eventType: 'TIME_IN' as EventType, start: clock.pmIn, end: clock.pmOut };
  return { eventType: 'TIME_OUT' as EventType, start: clock.pmIn, end: clock.pmOut };
}

export function timeWithinSlot(slot: AttendanceSlotName, time: string, shift: ShiftLike) {
  const meta = slotMeta(slot, shift);
  const value = minutesFromClock(time);
  return value >= minutesFromClock(meta.start) && value <= minutesFromClock(meta.end);
}

export function currentHalfDaySlot(now: Date, shift: ShiftLike): 'AM' | 'PM' | null {
  const clock = shiftClock(shift);
  const minutes = minutesFromDate(now);
  if (minutes >= minutesFromClock(clock.amIn) && minutes <= minutesFromClock(clock.amOut)) return 'AM';
  if (minutes >= minutesFromClock(clock.pmIn) && minutes <= minutesFromClock(clock.pmOut)) return 'PM';
  return null;
}

export function buildPunches(values: SlotValues) {
  return ([
    ['amTimeIn', values.amTimeIn],
    ['amTimeOut', values.amTimeOut],
    ['pmTimeIn', values.pmTimeIn],
    ['pmTimeOut', values.pmTimeOut],
  ] as Array<[AttendanceSlotName, string | null | undefined]>)
    .filter(([, time]) => Boolean(time))
    .map(([slot, time]) => ({ slot, time: time! }));
}

export function pickSlotLogs(logs: Attendance[], shift: ShiftLike): Record<AttendanceSlotName, Attendance | null> {
  const slots: Record<AttendanceSlotName, Attendance | null> = {
    amTimeIn: null,
    amTimeOut: null,
    pmTimeIn: null,
    pmTimeOut: null,
  };

  for (const log of logs) {
    const minute = minutesFromDate(log.timestamp);
    for (const slot of Object.keys(slots) as AttendanceSlotName[]) {
      const meta = slotMeta(slot, shift);
      if (
        log.eventType === meta.eventType &&
        minute >= minutesFromClock(meta.start) &&
        minute <= minutesFromClock(meta.end)
      ) {
        const current = slots[slot];
        if (!current) {
          slots[slot] = log;
        } else if (slot.endsWith('TimeOut') && log.timestamp > current.timestamp) {
          slots[slot] = log;
        } else if (slot.endsWith('TimeIn') && log.timestamp < current.timestamp) {
          slots[slot] = log;
        }
      }
    }
  }

  return slots;
}
