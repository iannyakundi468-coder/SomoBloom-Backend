import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { teacherProfiles, classes, assignments, grades } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const teacherRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => env.JWT_SECRET || 'somobloom_super_secret_dev_key_123';

// Apply JWT middleware
teacherRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a teacher
teacherRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'teacher') {
    return c.json({ error: 'Unauthorized: Teacher access required' }, 403);
  }
  await next();
});

teacherRouter.get('/ping', (c) => c.json({ message: 'Teacher API operational' }));

// Fetch Teacher Profile
teacherRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// List classes for the teacher
teacherRouter.get('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const teacherClasses = await db.select().from(classes).where(eq(classes.teacherProfileId, profile.id)).all();
  return c.json({ classes: teacherClasses });
});

// Create assignment for a class
teacherRouter.post('/classes/:classId/assignments', async (c) => {
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { title, description, dueDate } = body;

  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const assignmentId = crypto.randomUUID();

  try {
    await db.insert(assignments).values({
      id: assignmentId,
      classId,
      title,
      description,
      dueDate
    });
    return c.json({ message: 'Assignment created successfully', assignment: { id: assignmentId, classId, title } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create assignment' }, 500);
  }
});

// Grade an assignment
teacherRouter.post('/assignments/:assignmentId/grades', async (c) => {
  const { assignmentId } = c.req.param();
  const body = await c.req.json();
  const { studentProfileId, score, feedback } = body;

  if (!studentProfileId || score === undefined) {
    return c.json({ error: 'Student Profile ID and score are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const gradeId = crypto.randomUUID();

  try {
    await db.insert(grades).values({
      id: gradeId,
      assignmentId,
      studentProfileId,
      score,
      feedback
    });
    return c.json({ message: 'Grade submitted successfully', grade: { id: gradeId, score } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to submit grade' }, 500);
  }
});
