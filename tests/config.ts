/**
 * الغرض: إعدادات الاختبارات
 * الحالة: تنفيد فعلي — أساس تقني بحت
 */

export const testConfig = {
  timeout: 30000,
  databaseUrl: process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/wasla_test',
  redisUrl: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379',
};
