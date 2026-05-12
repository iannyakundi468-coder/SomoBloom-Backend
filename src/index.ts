import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { adminRouter } from './routes/admin';
import { teacherRouter } from './routes/teacher';
import { studentRouter } from './routes/student';
import { parentRouter } from './routes/parent';

export type Bindings = {
  DB: D1Database;
  AI: any; // Ai type from '@cloudflare/workers-types' but we can use any for now
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes so the frontends can communicate with this API
app.use('/api/*', cors({
  origin: (origin) => origin || '*', // Dynamically allow the requesting origin
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.get('/', (c) => {
  return c.text('Welcome to SomoBloom API Backend');
});

// Mount modular routers
app.route('/api/admin', adminRouter);
app.route('/api/teacher', teacherRouter);
app.route('/api/student', studentRouter);
app.route('/api/parent', parentRouter);

export default app;
