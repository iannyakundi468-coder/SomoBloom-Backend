import { Hono } from 'hono';
import type { Bindings } from '../../index';

export const teacherRouter = new Hono<{ Bindings: Bindings }>();

teacherRouter.get('/ping', (c) => c.json({ message: 'Teacher API operational' }));

// Add more teacher routes here
// e.g. managing classes, creating assignments, grading
