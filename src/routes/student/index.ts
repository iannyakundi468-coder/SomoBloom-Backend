import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { studentProfiles, classes, enrollments, assignments, grades, portfolioEvidence } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and } from 'drizzle-orm';
import type { Bindings } from '../../index';
import { generateText } from '../../ai';

export const studentRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

// Apply JWT middleware
studentRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a student
studentRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'student') {
    return c.json({ error: 'Unauthorized: Student access required' }, 403);
  }
  await next();
});

studentRouter.get('/ping', (c) => c.json({ message: 'Student API operational' }));

// Fetch Student Profile
studentRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// List enrolled classes for the student
studentRouter.get('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // We need to join enrollments and classes to get the classes the student is enrolled in
  const studentClasses = await db.select({
    id: classes.id,
    name: classes.name,
    teacherProfileId: classes.teacherProfileId
  })
  .from(enrollments)
  .innerJoin(classes, eq(enrollments.classId, classes.id))
  .where(eq(enrollments.studentProfileId, profile.id))
  .all();

  return c.json({ classes: studentClasses });
});

// Fetch assignments for a class
studentRouter.get('/classes/:classId/assignments', async (c) => {
  const { classId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // Check if student is enrolled in this class
  const enrollment = await db.select().from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.studentProfileId, profile.id)))
    .get();

  if (!enrollment) {
    return c.json({ error: 'Not enrolled in this class' }, 403);
  }

  const classAssignments = await db.select().from(assignments).where(eq(assignments.classId, classId)).all();
  return c.json({ assignments: classAssignments });
});

// Fetch all grades for the student
studentRouter.get('/grades', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const studentGrades = await db.select({
    id: grades.id,
    score: grades.score,
    feedback: grades.feedback,
    assignmentTitle: assignments.title,
    classId: assignments.classId
  })
  .from(grades)
  .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
  .where(eq(grades.studentProfileId, profile.id))
  .all();

  return c.json({ grades: studentGrades });
});

// AI Text generation endpoint for students (e.g., homework helper)
studentRouter.post('/ask-tutor', async (c) => {
  const body = await c.req.json();
  const prompt = body.prompt;

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  if (!c.env.AI) {
    return c.json({ response: "AI tutor is currently unavailable in the local environment." });
  }

  try {
    const response = await generateText(c.env.AI, `You are a helpful and encouraging tutor for a student. Answer the following question:\n\n${prompt}`);
    return c.json({ response });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update Student Profile
studentRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(studentProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(studentProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update student profile:', error);
    return c.json({ error: 'Failed to update student profile' }, 500);
  }
});

// Fetch student's own portfolio evidence (Cloudflare D1 Database)
studentRouter.get('/portfolio', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const items = await db.select().from(portfolioEvidence)
      .where(eq(portfolioEvidence.studentProfileId, profile.id))
      .all();

    return c.json({
      portfolio: items.map((item: any) => ({
        ...item,
        tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch student portfolio:', error);
    return c.json({ error: 'Failed to fetch portfolio evidence' }, 500);
  }
});
