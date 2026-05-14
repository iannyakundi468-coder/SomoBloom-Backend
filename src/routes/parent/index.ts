import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { parentProfiles, studentProfiles, parentStudentRelations, grades, assignments } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const parentRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => env.JWT_SECRET || 'somobloom_super_secret_dev_key_123';

// Apply JWT middleware
parentRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a parent
parentRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'parent') {
    return c.json({ error: 'Unauthorized: Parent access required' }, 403);
  }
  await next();
});

parentRouter.get('/ping', (c) => c.json({ message: 'Parent API operational' }));

// Fetch Parent Profile
parentRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// List linked students (children)
parentRouter.get('/students', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const linkedStudents = await db.select({
    id: studentProfiles.id,
    name: studentProfiles.name,
    studentIdNumber: studentProfiles.studentIdNumber
  })
  .from(parentStudentRelations)
  .innerJoin(studentProfiles, eq(parentStudentRelations.studentProfileId, studentProfiles.id))
  .where(eq(parentStudentRelations.parentProfileId, profile.id))
  .all();

  return c.json({ students: linkedStudents });
});

// Fetch grades for a specific child
parentRouter.get('/students/:studentId/grades', async (c) => {
  const { studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // Ensure this parent is linked to this student
  const relation = await db.select().from(parentStudentRelations)
    .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
    .get();

  if (!relation) {
    return c.json({ error: 'Not authorized to view this student\'s grades' }, 403);
  }

  const studentGrades = await db.select({
    id: grades.id,
    score: grades.score,
    feedback: grades.feedback,
    assignmentTitle: assignments.title,
    classId: assignments.classId
  })
  .from(grades)
  .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
  .where(eq(grades.studentProfileId, studentId))
  .all();

  return c.json({ grades: studentGrades });
});
