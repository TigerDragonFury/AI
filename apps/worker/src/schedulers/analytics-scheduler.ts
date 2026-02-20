import { analyticsSyncQueue } from '../queues';

export async function ensureAnalyticsSyncScheduler() {
  const every = Number(process.env.ANALYTICS_SYNC_EVERY_MS || 21600000);

  await analyticsSyncQueue.add(
    'analytics-sync-sweep',
    { mode: 'sweep' },
    {
      jobId: 'analytics-sync-sweep',
      repeat: { every },
      removeOnComplete: true,
      removeOnFail: 20
    }
  );

  return { every };
}
