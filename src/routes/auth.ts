import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { getDb } from '../db/client';
import { users, schools, adminProfiles, teacherProfiles, studentProfiles, parentProfiles } from '../db/schema';
import { hashPassword, verifyPassword, type JwtPayload } from '../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../lib/encryption';
import { eq, or } from 'drizzle-orm';

type Bindings = {
  DB: D1Database;
  JWT_SECRET?: string;
  ENCRYPTION_SECRET?: string;
  ENVIRONMENT?: string;
};

export const authRouter = new Hono<{ Bindings: Bindings }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

const getEncryptionSecret = (env: Bindings) => {
  if (env.ENCRYPTION_SECRET) return env.ENCRYPTION_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: ENCRYPTION_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_encryption_key_123';
};

authRouter.post('/register-school', async (c) => {
  const body = await c.req.json();
  const { schoolName, adminName, email, phoneNumber, password } = body;

  if (!schoolName || !adminName || !email || !password) {
    return c.json({ error: 'Missing required fields' }, 400);
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
    // Start a transaction to insert school, user, and admin profile
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
  const { email: identifier, password } = body;

  if (!identifier || !password) {
    return c.json({ error: 'Email/Phone and password are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);

  // Auto-seed if database is empty
  try {
    const existingUsers = await db.select().from(users).all();
    if (existingUsers.length === 0) {
      console.log('🌱 Database is empty. Seeding default admin and teacher...');
      const schoolId = crypto.randomUUID();
      const adminUserId = crypto.randomUUID();
      const adminProfileId = crypto.randomUUID();
      const teacherUserId = crypto.randomUUID();
      const teacherProfileId = crypto.randomUUID();
      
      const adminEmail = 'admin@somobloom.com';
      const teacherEmail = 'teacher1@somobloom.com';
      const defaultPassword = 'demo';
      
      const adminEmailHash = await hashIdentifier(adminEmail, encryptionSecret);
      const teacherEmailHash = await hashIdentifier(teacherEmail, encryptionSecret);
      
      const encAdminEmail = await encryptData(adminEmail, encryptionSecret);
      const encTeacherEmail = await encryptData(teacherEmail, encryptionSecret);
      
      const hashedPassword = await hashPassword(defaultPassword);
      
      await db.batch([
        db.insert(schools).values({
          id: schoolId,
          name: 'SomoBloom Academy',
        }),
        db.insert(users).values({
          id: adminUserId,
          emailHash: adminEmailHash,
          encryptedEmail: encAdminEmail,
          passwordHash: hashedPassword,
        }),
        db.insert(adminProfiles).values({
          id: adminProfileId,
          userId: adminUserId,
          schoolId,
          name: 'Admin User',
        }),
        db.insert(users).values({
          id: teacherUserId,
          emailHash: teacherEmailHash,
          encryptedEmail: encTeacherEmail,
          passwordHash: hashedPassword,
        }),
        db.insert(teacherProfiles).values({
          id: teacherProfileId,
          userId: teacherUserId,
          schoolId,
          name: 'Mrs. Janet Bloom',
          department: 'Science',
        })
      ]);
      console.log('✅ Auto-seed completed successfully!');
    }
  } catch (err) {
    console.error('Failed to auto-seed:', err);
  }

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

  // Generate JWT
  const payload: JwtPayload = {
    sub: user.id,
    schoolId: userSchoolId,
    role: userRole,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };

  const token = await sign(payload, getSecret(c.env), 'HS256');

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
