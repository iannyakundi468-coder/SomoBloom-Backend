import { Hono } from 'hono';
import type { Bindings } from '../../index';

export const parentRouter = new Hono<{ Bindings: Bindings }>();

parentRouter.get('/ping', (c) => c.json({ message: 'Parent API operational' }));

// Add more parent routes here
// e.g. monitoring student progress, contacting teachers
