import { Hono } from 'hono';
import type { Bindings } from '../../index';

export const adminRouter = new Hono<{ Bindings: Bindings }>();

adminRouter.get('/ping', (c) => c.json({ message: 'Admin API operational' }));

// Add more admin routes here
// e.g. managing global school settings, onboarding new teachers
