import { PrismaClient, EmploymentStatus, EventType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeDtr, dateOnly } from '../src/utils/dtr';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  'Office of the Mayor',
  'Human Resource Management Office',
  'Accounting Office',
  'Engineering Office',
  'Health Office',
  'Treasury Office',
];

const POSITIONS = [
  'Administrative Officer I',
  'Administrative Aide IV',
  'Computer Programmer II',
  'Engineer II',
  'Nurse I',
  'Accountant I',
  'Clerk III',
];

const STATUSES: EmploymentStatus[] = [
  'REGULAR',
  'CONTRACTUAL',
  'CASUAL',
  'JOB_ORDER',
  'COTERMINOUS',
];

const SAMPLE = [
  ['Juan', 'Santos', 'Dela Cruz'],
  ['Maria', 'Reyes', 'Garcia'],
  ['Pedro', 'Lopez', 'Bautista'],
  ['Ana', 'Cruz', 'Mendoza'],
  ['Jose', 'Ramos', 'Torres'],
  ['Liza', 'Flores', 'Aquino'],
  ['Mark', 'Villanueva', 'Castillo'],
  ['Grace', 'Gonzales', 'Domingo'],
  ['Paolo', 'Navarro', 'Rivera'],
  ['Carla', 'Salazar', 'Fernandez'],
];

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function createAttendanceIfMissing(employeeId: number, timestamp: Date, eventType: EventType) {
  const existing = await prisma.attendance.findFirst({
    where: { employeeId, timestamp, eventType },
  });
  if (existing) return;

  await prisma.attendance.create({
    data: { employeeId, timestamp, eventType },
  });
}

async function main() {
  console.log('Seeding database...');

  // Default admin
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash, role: 'ADMIN' },
  });

  // Default HR user
  const hrHash = await bcrypt.hash('hr12345', 10);
  await prisma.user.upsert({
    where: { username: 'hr' },
    update: {},
    create: { username: 'hr', passwordHash: hrHash, role: 'HR' },
  });

  const defaultShift = await prisma.shift.upsert({
    where: { name: 'Default Office Hours' },
    update: {},
    create: {
      name: 'Default Office Hours',
      amIn: '08:00',
      amOut: '12:00',
      pmIn: '13:00',
      pmOut: '17:00',
      regularDays: 'Monday-Friday',
      saturdayHours: 'Saturday as scheduled',
      overtimeStart: '17:00',
      overtimeEnd: null,
      graceMinutes: 0,
    },
  });

  const dummyEmployee = await prisma.employee.upsert({
    where: { employeeNumber: 'DUMMY-001' },
    update: {
      firstName: 'Dummy',
      middleName: 'M',
      lastName: 'Employee',
      department: 'Human Resource Management Office',
      position: 'Administrative Aide IV',
      status: 'REGULAR',
      shiftId: defaultShift.id,
    },
    create: {
      employeeNumber: 'DUMMY-001',
      firstName: 'Dummy',
      middleName: 'M',
      lastName: 'Employee',
      department: 'Human Resource Management Office',
      position: 'Administrative Aide IV',
      status: 'REGULAR',
      shiftId: defaultShift.id,
    },
  });

  const seedBase = new Date();
  const dummyDaysInMonth = new Date(seedBase.getFullYear(), seedBase.getMonth() + 1, 0).getDate();
  let dummyRecords = 0;

  for (let day = 1; day <= dummyDaysInMonth && dummyRecords < 12; day++) {
    const baseDay = new Date(seedBase.getFullYear(), seedBase.getMonth(), day);
    const dow = baseDay.getDay();
    if (dow === 0 || dow === 6) continue;

    const lateMinutes = dummyRecords % 4 === 0 ? 7 : 0;
    const outMinutes = dummyRecords % 5 === 0 ? 45 : 0;
    const timeIn = atTime(baseDay, 8, lateMinutes);
    const amOut = atTime(baseDay, 12, 0);
    const pmIn = atTime(baseDay, 13, 0);
    const timeOut = atTime(baseDay, 17, outMinutes);
    const dtrDate = dateOnly(baseDay);
    const computed = computeDtr(timeIn, timeOut, defaultShift);

    await createAttendanceIfMissing(dummyEmployee.id, timeIn, EventType.TIME_IN);
    await createAttendanceIfMissing(dummyEmployee.id, amOut, EventType.TIME_OUT);
    await createAttendanceIfMissing(dummyEmployee.id, pmIn, EventType.TIME_IN);
    await createAttendanceIfMissing(dummyEmployee.id, timeOut, EventType.TIME_OUT);

    await prisma.dTR.upsert({
      where: { employeeId_date: { employeeId: dummyEmployee.id, date: dtrDate } },
      update: {
        timeIn,
        timeOut,
        totalHours: computed.totalHours,
        lateMinutes: computed.lateMinutes,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: computed.overtimeMinutes,
      },
      create: {
        employeeId: dummyEmployee.id,
        date: dtrDate,
        timeIn,
        timeOut,
        totalHours: computed.totalHours,
        lateMinutes: computed.lateMinutes,
        undertimeMinutes: computed.undertimeMinutes,
        overtimeMinutes: computed.overtimeMinutes,
      },
    });

    dummyRecords++;
  }

  if (process.env.SEED_DEMO_DATA !== 'true') {
    console.log('Demo employees, attendance, and devices skipped.');
    console.log('Set SEED_DEMO_DATA=true to create sample records.');
    console.log('Seeding complete.');
    console.log('Login -> admin / admin123');
    return;
  }

  // Employees
  for (let i = 0; i < SAMPLE.length; i++) {
    const [firstName, middleName, lastName] = SAMPLE[i];
    const employeeNumber = String(1001 + i);
    await prisma.employee.upsert({
      where: { employeeNumber },
      update: {},
      create: {
        employeeNumber,
        firstName,
        middleName,
        lastName,
        department: DEPARTMENTS[i % DEPARTMENTS.length],
        position: POSITIONS[i % POSITIONS.length],
        status: STATUSES[i % STATUSES.length],
      },
    });
  }

  const employees = await prisma.employee.findMany();

  // Sample attendance for the last 7 days
  const today = new Date();
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - dayOffset);
    day.setHours(0, 0, 0, 0);

    // skip weekends
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const emp of employees) {
      // ~85% attendance
      if ((emp.id + dayOffset) % 7 === 0) continue;

      // vary time in a bit so some are late
      const lateMin = (emp.id * (dayOffset + 1)) % 25; // 0..24
      const timeIn = atTime(day, 8, lateMin);
      const timeOut = atTime(day, 17, (emp.id % 10));

      const existing = await prisma.attendance.findFirst({
        where: { employeeId: emp.id, timestamp: { gte: atTime(day, 0, 0), lt: atTime(day, 23, 59) }, eventType: 'TIME_IN' },
      });
      if (existing) continue;

      await prisma.attendance.create({
        data: { employeeId: emp.id, timestamp: timeIn, eventType: EventType.TIME_IN },
      });
      await prisma.attendance.create({
        data: { employeeId: emp.id, timestamp: timeOut, eventType: EventType.TIME_OUT },
      });
    }
  }

  // Sample device
  const deviceCount = await prisma.device.count();
  if (deviceCount === 0) {
    await prisma.device.create({
      data: { name: 'Main Lobby Biometric', ipAddress: '192.168.1.100', port: 4370, status: 'UNKNOWN' },
    });
  }

  console.log('Seeding complete.');
  console.log('Login -> admin / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
