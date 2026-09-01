import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getDb } from '../db/client';
import { users, schools, adminProfiles, teacherProfiles, studentProfiles, parentProfiles } from '../db/schema';
import { hashPassword, verifyPassword, type JwtPayload } from '../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../lib/encryption';
import { getJwtSecret, getEncryptionSecret } from '../lib/config';
import { rateLimiter } from '../lib/rateLimit';
import { eq, or } from 'drizzle-orm';
import type { Bindings } from '../index';

export const authRouter = new Hono<{ Bindings: Bindings }>();

// Rate limiters for security
const loginLimiter = rateLimiter({ windowMs: 60000, maxRequests: 5 }); // 5 requests per minute
const registerLimiter = rateLimiter({ windowMs: 3600000, maxRequests: 3 }); // 3 requests per hour

authRouter.post('/register-school', registerLimiter, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const { schoolName, adminName, email, phoneNumber, password } = body;

  if (!schoolName || !adminName || !email || !password) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  if (typeof password !== 'string' || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);
  
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const phoneNumberHash = phoneNumber ? await hashIdentifier(phoneNumber, encryptionSecret) : null;

  // 1. Check if user already exists
  let existingUser;
  if (phoneNumberHash) {
    existingUser = await db.select().from(users).where(or(eq(users.emailHash, emailHash), eq(users.phoneNumberHash, phoneNumberHash))).get();
  } else {
    existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  }
  
  if (existingUser) {
    return c.json({ error: 'User with this email or phone number already exists' }, 400);
  }

  const schoolId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminProfileId = crypto.randomUUID();
  
  const hashedPassword = await hashPassword(password);
  
  const encryptedEmail = await encryptData(email, encryptionSecret);
  const encryptedPhoneNumber = phoneNumber ? await encryptData(phoneNumber, encryptionSecret) : null;

  try {
    await db.batch([
      db.insert(schools).values({
        id: schoolId,
        name: schoolName,
      }),
      db.insert(users).values({
        id: userId,
        emailHash,
        encryptedEmail,
        phoneNumberHash,
        encryptedPhoneNumber,
        passwordHash: hashedPassword,
      }),
      db.insert(adminProfiles).values({
        id: adminProfileId,
        userId,
        schoolId,
        name: adminName,
      })
    ]);

    const payload: JwtPayload = {
      sub: userId,
      schoolId: schoolId,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };

    const token = await sign(payload, getJwtSecret(c.env), 'HS256');

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

authRouter.post('/login', loginLimiter, async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) {
    return c.json({ error: 'Invalid JSON request body' }, 400);
  }

  const { email: identifier, password } = body;

  if (!identifier || !password) {
    return c.json({ error: 'Email/Phone and password are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);
  const identifierHash = await hashIdentifier(identifier, encryptionSecret);

  // 1. Find user
  const user = await db.select().from(users).where(
    or(
      eq(users.emailHash, identifierHash),
      eq(users.phoneNumberHash, identifierHash)
    )
  ).get();

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

  const payload: JwtPayload = {
    sub: user.id,
    schoolId: userSchoolId,
    role: userRole,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const token = await sign(payload, getJwtSecret(c.env), 'HS256');
  const decryptedEmail = await decryptData(user.encryptedEmail, encryptionSecret);

  return c.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: decryptedEmail,
      name: userProfileName,
      role: userRole,
      schoolId: userSchoolId
    }
  });
});
