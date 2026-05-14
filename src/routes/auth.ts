import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getDb } from '../db/client';
import { users, schools, adminProfiles } from '../db/schema';
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
  // For now, let's assume they are an Admin. In a real app, we would check all profile tables 
  // (adminProfiles, teacherProfiles, studentProfiles, parentProfiles) to determine their role.
  const adminProfile = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, user.id)).get();
  
  if (!adminProfile) {
    // Placeholder: Need to check other profile types here if they aren't an admin
    return c.json({ error: 'User profile not found. Multi-role login not fully implemented.' }, 403);
  }

  // Generate JWT
  const payload: JwtPayload = {
    sub: user.id,
    schoolId: adminProfile.schoolId,
    role: 'admin', // Hardcoded to admin for now based on profile check
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const token = await sign(payload, getSecret(c.env));

  return c.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: adminProfile.name,
      role: 'admin',
      schoolId: adminProfile.schoolId
    }
  });
});
