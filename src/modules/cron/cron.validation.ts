import { z } from 'zod';
import { CRON_JOB_NAMES } from '../../common/constants/cron.constant';

const validJobNames = Object.values(CRON_JOB_NAMES) as [string, ...string[]];

export const cronJobNameParamSchema = z.object({
  jobName: z.enum(validJobNames, {
    errorMap: () => ({ message: `Tên job không hợp lệ. Cho phép: ${validJobNames.join(', ')}` }),
  }),
});

export const triggerCronJobSchema = z.object({
  params: z.record(z.unknown()).optional().default({}),
});

export const listCronJobsQuerySchema = z.object({
  search: z.string().optional(),
});

export const toggleCronJobSchema = z.object({
  enabled: z.boolean({ required_error: 'Trạng thái enabled là bắt buộc (true/false)' }),
});
