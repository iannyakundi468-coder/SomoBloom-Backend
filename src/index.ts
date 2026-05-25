import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { teacherRouter } from './routes/teacher';
import { studentRouter } from './routes/student';
import { parentRouter } from './routes/parent';
import { messagesRouter } from './routes/messages';
import { mediaRouter } from './routes/media';

export type Bindings = {
  DB: D1Database;
  AI: any; // Ai type from '@cloudflare/workers-types' but we can use any for now
  MEDIA_KV: KVNamespace;
  BUCKET?: any;
  JWT_SECRET?: string;
  ENCRYPTION_SECRET?: string;
  ENVIRONMENT?: string;
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
  return c.json({
    status: 'operational',
    service: 'SomoBloom API Backend',
    version: '1.0.0',
    documentation: '/api'
  });
});


// Mount modular routers
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/teacher', teacherRouter);
app.route('/api/student', studentRouter);
app.route('/api/parent', parentRouter);
app.route('/api/messages', messagesRouter);
app.route('/api/media', mediaRouter);

export default app;
