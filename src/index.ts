import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth';
import { adminRouter } from './routes/admin';
import { teacherRouter } from './routes/teacher';
import { studentRouter } from './routes/student';
import { parentRouter } from './routes/parent';
import { messagesRouter } from './routes/messages';
import { mediaRouter } from './routes/media';
import { getAllowedOrigins } from './lib/config';

export type Bindings = {
  DB: D1Database;
  AI: any;
  MEDIA_KV: KVNamespace;
  BUCKET?: any;
  JWT_SECRET?: string;
  ENCRYPTION_SECRET?: string;
  ENVIRONMENT?: string;
  ALLOWED_ORIGINS?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Configure strict CORS policy for all API routes
app.use('/api/*', (c, next) => {
  const allowed = getAllowedOrigins(c.env);
  const isProduction = c.env.ENVIRONMENT === 'production';
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return allowed[0];
      if (allowed.includes(origin)) return origin;
      
      // Allow any somobloom.com subdomain
      if (origin.endsWith('.somobloom.com')) {
        return origin;
      }

      // Allow staging/preview deployments in non-production environments
      if (!isProduction && (origin.endsWith('.workers.dev') || origin.endsWith('.pages.dev'))) {
        return origin;
      }

      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Application Error:', err);
  
  const isProduction = c.env.ENVIRONMENT === 'production';
  return c.json({
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred.' : err.message,
  }, 500);
});

// Global Not Found Handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: `Route ${c.req.method} ${c.req.path} does not exist.`
  }, 404);
});

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
