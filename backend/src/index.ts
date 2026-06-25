import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import attendanceRoutes from './routes/attendance';
import dtrRoutes from './routes/dtr';
import dashboardRoutes from './routes/dashboard';
import deviceRoutes, { receiveAttendance, receiveHeartbeat } from './routes/devices';
import reportRoutes from './routes/reports';
import { startDeviceLogAutoSync } from './jobs/deviceLogAutoSync';
import shiftRoutes from './routes/shifts';
import hiddenAdminCodeRoutes from './routes/hiddenAdminCode';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const captureRawBody = (req: any, _res: express.Response, buf: Buffer) => {
  if (buf.length > 0) req.rawBody = buf.toString('utf8');
};

app.use(cors());
app.use(express.json({ verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody }));
app.use(express.text({ type: ['text/*', 'application/xml'], verify: captureRawBody }));
app.use(express.raw({ type: 'application/octet-stream', verify: captureRawBody }));

app.get('/', (_req, res) => {
  res.json({ name: 'DTR Management System API', status: 'ok' });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Some attendance devices send to fixed paths and only allow Server IP/Port.
app.get(['/iclock/cdata', '/iclock/getrequest', '/cdata'], receiveHeartbeat);
app.post(['/', '/iclock/cdata', '/cdata', '/device/attendance'], receiveAttendance);

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dtr', dtrRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/_hidden/admin-code', hiddenAdminCodeRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`DTR backend listening on port ${PORT}`);
  startDeviceLogAutoSync();
});
