import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { users, adminProfiles, teacherProfiles, studentProfiles, parentProfiles, classes, parentStudentRelations, enrollments, studentEnrollmentSubmissions } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../../lib/encryption';
import { eq } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const adminRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

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
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  // Check if email already exists
  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
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
        emailHash,
        encryptedEmail,
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
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, emailHash, encryptedEmail, passwordHash: hashedPassword }),
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
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const parentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, emailHash, encryptedEmail, passwordHash: hashedPassword }),
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

adminRouter.get('/enrollments', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const submissions = await db.select().from(studentEnrollmentSubmissions).all();
    return c.json({ enrollments: submissions });
  } catch (error: any) {
    console.error('Failed to fetch enrollments:', error);
    return c.json({ error: 'Failed to fetch enrollment submissions' }, 500);
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const admins = await db.select({
      id: adminProfiles.id,
      userId: adminProfiles.userId,
      name: adminProfiles.name,
      encryptedEmail: users.encryptedEmail,
      createdAt: adminProfiles.createdAt,
    })
    .from(adminProfiles)
    .innerJoin(users, eq(adminProfiles.userId, users.id))
    .all();

    const teachers = await db.select({
      id: teacherProfiles.id,
      userId: teacherProfiles.userId,
      name: teacherProfiles.name,
      encryptedEmail: users.encryptedEmail,
      createdAt: teacherProfiles.createdAt,
      department: teacherProfiles.department,
    })
    .from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .all();

    const students = await db.select({
      id: studentProfiles.id,
      userId: studentProfiles.userId,
      name: studentProfiles.name,
      encryptedEmail: users.encryptedEmail,
      createdAt: studentProfiles.createdAt,
      studentIdNumber: studentProfiles.studentIdNumber,
    })
    .from(studentProfiles)
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .all();

    const parents = await db.select({
      id: parentProfiles.id,
      userId: parentProfiles.userId,
      name: parentProfiles.name,
      encryptedEmail: users.encryptedEmail,
      createdAt: parentProfiles.createdAt,
      phoneNumber: parentProfiles.phoneNumber,
    })
    .from(parentProfiles)
    .innerJoin(users, eq(parentProfiles.userId, users.id))
    .all();

    
    const encryptionSecret = getEncryptionSecret(c.env);

    const decryptUserEmail = async (u: any) => {
      const email = await decryptData(u.encryptedEmail, encryptionSecret);
      const { encryptedEmail, ...rest } = u;
      return { ...rest, email };
    };

    const combinedUsers = await Promise.all([
      ...admins.map(a => ({ ...a, role: 'admin', status: 'active' })),
      ...teachers.map(t => ({ ...t, role: 'teacher', status: 'active' })),
      ...students.map(s => ({ ...s, role: 'student', status: 'active' })),
      ...parents.map(p => ({ ...p, role: 'parent', status: 'active' }))
    ].map(decryptUserEmail));

    return c.json({ users: combinedUsers });
  } catch (error: any) {
    console.error('Failed to fetch users:', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
});

// GET /api/admin/classes
adminRouter.get('/classes', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const classesList = await db.select({
      id: classes.id,
      name: classes.name,
      teacherProfileId: classes.teacherProfileId,
      teacherName: teacherProfiles.name,
      createdAt: classes.createdAt,
    })
    .from(classes)
    .leftJoin(teacherProfiles, eq(classes.teacherProfileId, teacherProfiles.id))
    .all();

    const allEnrollments = await db.select().from(enrollments).all();

    const formattedClasses = classesList.map(cls => {
      const classEnrollments = allEnrollments
        .filter(e => e.classId === cls.id)
        .map(e => e.studentProfileId);

      return {
        id: cls.id,
        name: cls.name,
        teacherId: cls.teacherProfileId,
        teacher: cls.teacherName || 'Unassigned',
        students: classEnrollments
      };
    });

    return c.json({ classes: formattedClasses });
  } catch (error: any) {
    console.error('Failed to fetch classes:', error);
    return c.json({ error: 'Failed to fetch classes' }, 500);
  }
});

// PUT /api/admin/users/:id
adminRouter.put('/users/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, email, department, studentIdNumber, phoneNumber } = body;

  const db = getDb(c.env.DB);
  try {
    let user = await db.select().from(users).where(eq(users.id, id)).get();
    let userId = id;

    if (!user) {
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.id, id)).get();
      if (teacher) {
        userId = teacher.userId;
      } else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, id)).get();
        if (student) {
          userId = student.userId;
        } else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.id, id)).get();
          if (parent) {
            userId = parent.userId;
          }
        }
      }
      user = await db.select().from(users).where(eq(users.id, userId)).get();
    }

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    const updates: Promise<any>[] = [];
    const encryptionSecret = getEncryptionSecret(c.env);

    if (email) {
      const emailHash = await hashIdentifier(email, encryptionSecret);
      const encryptedEmail = await encryptData(email, encryptionSecret);
      updates.push(db.update(users).set({ emailHash, encryptedEmail }).where(eq(users.id, userId)));
    }

    const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).get();
    if (teacher) {
      updates.push(db.update(teacherProfiles).set({
        name: name || teacher.name,
        department: department !== undefined ? department : teacher.department
      }).where(eq(teacherProfiles.userId, userId)));
    }

    const student = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).get();
    if (student) {
      updates.push(db.update(studentProfiles).set({
        name: name || student.name,
        studentIdNumber: studentIdNumber !== undefined ? studentIdNumber : student.studentIdNumber
      }).where(eq(studentProfiles.userId, userId)));
    }

    const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, userId)).get();
    if (parent) {
      updates.push(db.update(parentProfiles).set({
        name: name || parent.name,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : parent.phoneNumber
      }).where(eq(parentProfiles.userId, userId)));
    }

    await Promise.all(updates);

    return c.json({ message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Failed to update user:', error);
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  try {
    let user = await db.select().from(users).where(eq(users.id, id)).get();
    let userId = id;

    if (!user) {
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.id, id)).get();
      if (teacher) {
        userId = teacher.userId;
      } else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, id)).get();
        if (student) {
          userId = student.userId;
        } else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.id, id)).get();
          if (parent) {
            userId = parent.userId;
          }
        }
      }
    }

    await db.batch([
      db.delete(teacherProfiles).where(eq(teacherProfiles.userId, userId)),
      db.delete(studentProfiles).where(eq(studentProfiles.userId, userId)),
      db.delete(parentProfiles).where(eq(parentProfiles.userId, userId)),
      db.delete(users).where(eq(users.id, userId))
    ]);

    return c.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return c.json({ error: 'Failed to delete user' }, 500);
  }
});

// PUT /api/admin/classes/:id
adminRouter.put('/classes/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { name, teacherId } = body;

  const db = getDb(c.env.DB);
  try {
    const classItem = await db.select().from(classes).where(eq(classes.id, id)).get();
    if (!classItem) {
      return c.json({ error: 'Class not found' }, 404);
    }

    await db.update(classes).set({
      name: name || classItem.name,
      teacherProfileId: teacherId || classItem.teacherProfileId
    }).where(eq(classes.id, id));

    return c.json({ message: 'Class updated successfully' });
  } catch (error: any) {
    console.error('Failed to update class:', error);
    return c.json({ error: 'Failed to update class' }, 500);
  }
});

// DELETE /api/admin/classes/:id
adminRouter.delete('/classes/:id', async (c) => {
  const { id } = c.req.param();
  const db = getDb(c.env.DB);
  try {
    await db.batch([
      db.delete(enrollments).where(eq(enrollments.classId, id)),
      db.delete(classes).where(eq(classes.id, id))
    ]);

    return c.json({ message: 'Class deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete class:', error);
    return c.json({ error: 'Failed to delete class' }, 500);
  }
});

// Update Admin Profile
adminRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(adminProfiles).where(eq(adminProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(adminProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(adminProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update admin profile:', error);
    return c.json({ error: 'Failed to update admin profile' }, 500);
  }
});
