export type Role = 'ADMIN' | 'HR';

export interface User {
  id: number;
  username: string;
  role: Role;
}

export type EmploymentStatus = 'REGULAR' | 'CONTRACTUAL' | 'CASUAL' | 'JOB_ORDER' | 'COTERMINOUS';

export interface Shift {
  id: number;
  name: string;
  amIn: string;
  amOut: string;
  pmIn: string;
  pmOut: string;
  regularDays: string;
  saturdayHours?: string | null;
  overtimeStart?: string | null;
  overtimeEnd?: string | null;
  graceMinutes: number;
  createdAt: string;
  _count?: { employees: number };
}

export interface Employee {
  id: number;
  employeeNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  department: string;
  position: string;
  status: EmploymentStatus;
  shiftId?: number | null;
  shift?: Shift | null;
  createdAt: string;
}

export type EventType = 'TIME_IN' | 'TIME_OUT';

export interface Attendance {
  id: number;
  employeeId: number;
  timestamp: string;
  eventType: EventType;
  deviceId?: number | null;
  createdAt: string;
  employee?: Employee;
  device?: Device | null;
}

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

export interface Device {
  id: number;
  name: string;
  ipAddress: string;
  port: number;
  status: DeviceStatus;
  lastCheck?: string | null;
  createdAt: string;
}

export interface DTR {
  id: number;
  employeeId: number;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  totalHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  employee?: Employee;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  recentLogs: Attendance[];
}

export interface ChartPoint {
  label: string;
  present: number;
  late: number;
}
