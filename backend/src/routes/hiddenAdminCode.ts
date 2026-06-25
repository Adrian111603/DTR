import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import {
  assertAttendanceAdminCode,
  attendanceAdminCode,
  updateAttendanceAdminCode,
} from '../utils/attendanceSlots';

const router = Router();
router.use(authenticate);

const updateSchema = z.object({
  currentCode: z.string().min(1),
  newCode: z.string().min(4),
});

router.get('/', (_req, res) => {
  res.json({ configured: Boolean(attendanceAdminCode()) });
});

router.put('/', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });

  if (!assertAttendanceAdminCode(parsed.data.currentCode)) {
    return res.status(403).json({ message: 'Current admin code is incorrect' });
  }

  updateAttendanceAdminCode(parsed.data.newCode);
  res.json({ message: 'Admin code updated' });
});

export default router;
