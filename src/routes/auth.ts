import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getDb } from '../db/client';
import { users, schools, adminProfiles, teacherProfiles, studentProfiles, parentProfiles } from '../db/schema';
import { hashPassword, verifyPassword, type JwtPayload } from '../lib/auth';
import { eq } from 'drizzle-orm';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const authRouter = new Hono<{ Bindings: Bindings }>();

// Optional helper for getting secret (fallback for local dev if not set)
const getSecret = (env: Bindings) => env.JWT_SECRET || 'somobloom_super_secret_dev_key_123';

authRouter.post('/register-school', async (c) => {
  const body = await c.req.json();
  const { schoolName, adminName, email, password } = body;

  if (!schoolName || !adminName || !email || !password) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const db = getDb(c.env.DB);
  
  // 1. Check if user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const schoolId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminProfileId = crypto.randomUUID();
  
  const hashedPassword = await hashPassword(password);

  try {
    // Start a transaction to insert school, user, and admin profile
    await db.batch([
      db.insert(schools).values({
        id: schoolId,
        name: schoolName,
      }),
      db.insert(users).values({
        id: userId,
        email,
        passwordHash: hashedPassword,
      }),
      db.insert(adminProfiles).values({
        id: adminProfileId,
        userId,
        schoolId,
        name: adminName,
      })
    ]);

    // Generate JWT
    const payload: JwtPayload = {
      sub: userId,
      schoolId: schoolId,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days expiration
    };

    const token = await sign(payload, getSecret(c.env));

    return c.json({
      message: 'School registered successfully',
      token,
      user: {
        id: userId,
        email,
        name: adminName,
        role: 'admin',
        schoolId
      }
    }, 201);

  } catch (error: any) {
    console.error('Registration error:', error);
    return c.json({ error: 'Failed to register school' }, 500);
  }
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json();
  const { email, password } = body;

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const db = getDb(c.env.DB);

  // 1. Find user
  const user = await db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // 2. Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // 3. Find user profile to get role and schoolId
  let userRole: 'admin' | 'teacher' | 'student' | 'parent' | null = null;
  let userProfileName = '';
  let userSchoolId = '';

  const adminProfile = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, user.id)).get();
  if (adminProfile) {
    userRole = 'admin';
    userProfileName = adminProfile.name;
    userSchoolId = adminProfile.schoolId;
  } else {
    const teacherProfile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, user.id)).get();
    if (teacherProfile) {
      userRole = 'teacher';
      userProfileName = teacherProfile.name;
      userSchoolId = teacherProfile.schoolId;
    } else {
      const studentProfile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id)).get();
      if (studentProfile) {
        userRole = 'student';
        userProfileName = studentProfile.name;
        userSchoolId = studentProfile.schoolId;
      } else {
        const parentProfile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, user.id)).get();
        if (parentProfile) {
          userRole = 'parent';
          userProfileName = parentProfile.name;
          userSchoolId = parentProfile.schoolId;
        }
      }
    }
  }

  if (!userRole) {
    return c.json({ error: 'User profile not found.' }, 403);
  }

  // Generate JWT
  const payload: JwtPayload = {
    sub: user.id,
    schoolId: userSchoolId,
    role: userRole,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const token = await sign(payload, getSecret(c.env), 'HS256');

  return c.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: userProfileName,
      role: userRole,
      schoolId: userSchoolId
    }
  });
});
