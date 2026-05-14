import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { users, adminProfiles, teacherProfiles, studentProfiles, parentProfiles, classes, parentStudentRelations, enrollments } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { eq } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const adminRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => env.JWT_SECRET || 'somobloom_super_secret_dev_key_123';

// Apply JWT middleware to all admin routes
adminRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is an admin
adminRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'admin') {
    return c.json({ error: 'Unauthorized: Admin access required' }, 403);
  }
  await next();
});

adminRouter.get('/ping', (c) => c.json({ message: 'Admin API operational' }));

adminRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const adminProfile = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, payload.sub)).get();
  
  if (!adminProfile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  return c.json({ profile: adminProfile });
});

adminRouter.post('/teachers', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, email, password, department } = body;

  if (!name || !email || !password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  const db = getDb(c.env.DB);

  // Check if email already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const teacherProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash: hashedPassword,
      }),
      db.insert(teacherProfiles).values({
        id: teacherProfileId,
        userId,
        schoolId: payload.schoolId,
        name,
        department,
      })
    ]);

    return c.json({
      message: 'Teacher created successfully',
      teacher: {
        id: teacherProfileId,
        userId,
        name,
        department,
        email
      }
    }, 201);
  } catch (error: any) {
    console.error('Failed to create teacher:', error);
    return c.json({ error: 'Failed to create teacher' }, 500);
  }
});

adminRouter.post('/students', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, email, password, studentIdNumber } = body;

  if (!name || !email || !password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, email, passwordHash: hashedPassword }),
      db.insert(studentProfiles).values({
        id: studentProfileId,
        userId,
        schoolId: payload.schoolId,
        name,
        studentIdNumber
      })
    ]);
    return c.json({ message: 'Student created successfully', student: { id: studentProfileId, userId, name, email } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create student' }, 500);
  }
});

adminRouter.post('/parents', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, email, password, phoneNumber } = body;

  if (!name || !email || !password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const parentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, email, passwordHash: hashedPassword }),
      db.insert(parentProfiles).values({
        id: parentProfileId,
        userId,
        schoolId: payload.schoolId,
        name,
        phoneNumber
      })
    ]);
    return c.json({ message: 'Parent created successfully', parent: { id: parentProfileId, userId, name, email } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create parent' }, 500);
  }
});

adminRouter.post('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, teacherProfileId } = body;

  if (!name || !teacherProfileId) {
    return c.json({ error: 'Name and teacherProfileId are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const classId = crypto.randomUUID();

  try {
    await db.insert(classes).values({
      id: classId,
      schoolId: payload.schoolId,
      teacherProfileId,
      name
    });
    return c.json({ message: 'Class created successfully', class: { id: classId, name, teacherProfileId } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create class' }, 500);
  }
});

adminRouter.post('/parents/:parentId/students/:studentId', async (c) => {
  const { parentId, studentId } = c.req.param();
  const db = getDb(c.env.DB);

  try {
    await db.insert(parentStudentRelations).values({
      parentProfileId: parentId,
      studentProfileId: studentId
    });
    return c.json({ message: 'Student linked to parent successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to link student to parent' }, 500);
  }
});

adminRouter.post('/classes/:classId/enrollments', async (c) => {
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { studentProfileId } = body;

  if (!studentProfileId) {
    return c.json({ error: 'studentProfileId is required' }, 400);
  }

  const db = getDb(c.env.DB);

  try {
    await db.insert(enrollments).values({
      classId,
      studentProfileId
    });
    return c.json({ message: 'Student enrolled in class successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to enroll student' }, 500);
  }
});
