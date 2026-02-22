import { z } from 'zod';
import type { Job } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  jobs: {
    list: {
      method: 'GET' as const,
      path: '/api/jobs' as const,
      input: z.object({
        search: z.string().optional(),
        location: z.string().optional(),
        type: z.string().optional(),
        page: z.coerce.number().optional().default(1),
      }).optional(),
      responses: {
        200: z.object({
          jobs: z.array(z.custom<Job>()),
          total: z.number(),
          sources: z.record(z.string(), z.number()),
          lastUpdated: z.string().nullable(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/jobs/:id' as const,
      responses: {
        200: z.custom<Job>(),
        404: errorSchemas.notFound,
      },
    }
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
