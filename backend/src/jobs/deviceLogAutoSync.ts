import { prisma } from '../prisma';
import { syncDeviceLogInfo } from '../routes/devices';

let running = false;
let timer: NodeJS.Timeout | null = null;

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function autoSyncEnabled(): boolean {
  return process.env.DEVICE_LOG_AUTO_SYNC !== 'false';
}

export function startDeviceLogAutoSync() {
  if (timer || !autoSyncEnabled()) return;

  const intervalMs = numberEnv('DEVICE_LOG_SYNC_INTERVAL_MS', 60_000);
  const webPort = numberEnv('DEVICE_LOG_WEB_PORT', 80);
  const password = process.env.DEVICE_LOG_WEB_PASSWORD || '12345';

  async function runOnce() {
    if (running) return;
    running = true;

    try {
      const devices = await prisma.device.findMany({ orderBy: { id: 'asc' } });
      for (const device of devices) {
        try {
          const result = await syncDeviceLogInfo(device, { password, webPort });
          if (result.imported > 0) {
            console.log('[device auto sync]', {
              deviceId: device.id,
              ipAddress: device.ipAddress,
              imported: result.imported,
              skippedDuplicates: result.skippedDuplicates,
            });
          }
        } catch (err: any) {
          await prisma.device.update({
            where: { id: device.id },
            data: { status: 'OFFLINE', lastCheck: new Date() },
          });
          console.warn('[device auto sync failed]', {
            deviceId: device.id,
            ipAddress: device.ipAddress,
            message: err.message || 'Failed to sync device logs',
          });
        }
      }
    } catch (err: any) {
      console.warn('[device auto sync failed]', {
        message: err.message || 'Failed to run device auto sync',
      });
    } finally {
      running = false;
    }
  }

  timer = setInterval(runOnce, intervalMs);
  setTimeout(runOnce, 5_000);
  console.log(`[device auto sync] enabled every ${intervalMs}ms on web port ${webPort}`);
}
