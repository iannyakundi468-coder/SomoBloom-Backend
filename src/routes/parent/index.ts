import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { parentProfiles, studentProfiles, parentStudentRelations, grades, assignments, announcements, classes, teacherProfiles, enrollments, portfolioEvidence } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and, or } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const parentRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

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

// Fetch Announcements for Parents
parentRouter.get('/announcements', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const rawAnnouncements = await db.select()
      .from(announcements)
      .where(or(eq(announcements.targetAudience, 'parents'), eq(announcements.targetAudience, 'all')))
      .all();

    const formatted = rawAnnouncements.map((ann: any) => ({
      id: ann.id,
      title: ann.title,
      details: ann.content,
      date: ann.createdAt.split('T')[0]
    }));

    return c.json({ announcements: formatted });
  } catch (err: any) {
    console.error('Failed to fetch announcements:', err);
    return c.json({ error: 'Failed to fetch announcements' }, 500);
  }
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

  // Enrich children with class and teacher details
  const enrichedStudents = await Promise.all(linkedStudents.map(async (student: any) => {
    const studentEnrollment = await db.select({
      classId: classes.id,
      className: classes.name,
      teacherProfileId: classes.teacherProfileId,
      teacherName: teacherProfiles.name,
      teacherUserId: teacherProfiles.userId
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(teacherProfiles, eq(classes.teacherProfileId, teacherProfiles.id))
    .where(eq(enrollments.studentProfileId, student.id))
    .get();

    return {
      ...student,
      grade: studentEnrollment?.className || 'Unassigned Grade',
      teacherName: studentEnrollment?.teacherName || 'No Teacher Assigned',
      teacherUserId: studentEnrollment?.teacherUserId || null
    };
  }));

  return c.json({ students: enrichedStudents });
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

// Update Parent Profile
parentRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(parentProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(parentProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update parent profile:', error);
    return c.json({ error: 'Failed to update parent profile' }, 500);
  }
});

// Fetch portfolio evidence for a specific child (Cloudflare D1 Database)
parentRouter.get('/students/:studentId/portfolio', async (c) => {
  const { studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    // Ensure this parent is linked to this student
    const relation = await db.select().from(parentStudentRelations)
      .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
      .get();

    if (!relation) {
      return c.json({ error: 'Not authorized to view this student\'s portfolio' }, 403);
    }

    const items = await db.select().from(portfolioEvidence)
      .where(eq(portfolioEvidence.studentProfileId, studentId))
      .all();

    return c.json({
      portfolio: items.map((item: any) => ({
        ...item,
        tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch parent child portfolio:', error);
    return c.json({ error: 'Failed to fetch child portfolio evidence' }, 500);
  }
});
