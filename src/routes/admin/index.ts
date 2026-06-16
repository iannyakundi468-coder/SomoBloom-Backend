import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { users, adminProfiles, teacherProfiles, studentProfiles, parentProfiles, classes, parentStudentRelations, enrollments, studentEnrollmentSubmissions, activityLogs, auditLogs, schoolSettings, feeStructures, payments, timetables } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../../lib/encryption';
import { eq, and, desc } from 'drizzle-orm';
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
  return c.json({ 
    error: 'Student creation is restricted to Class Teachers. Please use the Teacher Portal or the /teacher/classes/:classId/students endpoint.' 
  }, 403);
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
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const submissions = await db.select().from(studentEnrollmentSubmissions).where(eq(studentEnrollmentSubmissions.schoolId, payload.schoolId)).all();
    return c.json({ enrollments: submissions });
  } catch (error: any) {
    console.error('Failed to fetch enrollments:', error);
    return c.json({ error: 'Failed to fetch enrollment submissions' }, 500);
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (c) => {
  const payload = c.get('jwtPayload');
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
    .where(eq(adminProfiles.schoolId, payload.schoolId))
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
    .where(eq(teacherProfiles.schoolId, payload.schoolId))
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
    .where(eq(studentProfiles.schoolId, payload.schoolId))
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
    .where(eq(parentProfiles.schoolId, payload.schoolId))
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
    const payload = c.get('jwtPayload');
    let user = await db.select().from(users).where(eq(users.id, id)).get();
    let userId = id;
    let userSchoolId = null;

    if (!user) {
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.id, id)).get();
      if (teacher) {
        userId = teacher.userId;
        userSchoolId = teacher.schoolId;
      } else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, id)).get();
        if (student) {
          userId = student.userId;
          userSchoolId = student.schoolId;
        } else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.id, id)).get();
          if (parent) {
            userId = parent.userId;
            userSchoolId = parent.schoolId;
          }
        }
      }
      user = await db.select().from(users).where(eq(users.id, userId)).get();
    } else {
      // If found by user id, we still need to verify their school
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).get();
      if (teacher) userSchoolId = teacher.schoolId;
      else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).get();
        if (student) userSchoolId = student.schoolId;
        else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, userId)).get();
          if (parent) userSchoolId = parent.schoolId;
        }
      }
    }

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    if (userSchoolId && userSchoolId !== payload.schoolId) {
      return c.json({ error: 'Unauthorized: User does not belong to your school' }, 403);
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
    const payload = c.get('jwtPayload');
    let user = await db.select().from(users).where(eq(users.id, id)).get();
    let userId = id;
    let userSchoolId = null;

    if (!user) {
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.id, id)).get();
      if (teacher) { userId = teacher.userId; userSchoolId = teacher.schoolId; }
      else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, id)).get();
        if (student) { userId = student.userId; userSchoolId = student.schoolId; }
        else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.id, id)).get();
          if (parent) { userId = parent.userId; userSchoolId = parent.schoolId; }
        }
      }
    } else {
      const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).get();
      if (teacher) userSchoolId = teacher.schoolId;
      else {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).get();
        if (student) userSchoolId = student.schoolId;
        else {
          const parent = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, userId)).get();
          if (parent) userSchoolId = parent.schoolId;
        }
      }
    }
    
    if (userSchoolId && userSchoolId !== payload.schoolId) {
      return c.json({ error: 'Unauthorized: User does not belong to your school' }, 403);
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
  const payload = c.get('jwtPayload');

  const db = getDb(c.env.DB);
  try {
    const classItem = await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.schoolId, payload.schoolId))).get();
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
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const cls = await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.schoolId, payload.schoolId))).get();
    if (!cls) return c.json({ error: 'Class not found' }, 404);
    
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

// GET /api/admin/activity
adminRouter.get('/activity', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const logs = await db.select().from(activityLogs).where(eq(activityLogs.schoolId, payload.schoolId)).orderBy(desc(activityLogs.createdAt)).limit(50).all();
    const formatted = logs.map(l => {
      const dt = new Date(l.createdAt);
      return {
        id: l.id,
        user: l.user,
        action: l.action,
        detail: l.detail,
        color: l.color || '#6366f1',
        time: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
      };
    });
    return c.json({ activity: formatted });
  } catch (error: any) {
    console.error('Failed to fetch activity logs:', error);
    return c.json({ error: 'Failed to fetch activity logs' }, 500);
  }
});

// GET /api/admin/audit
adminRouter.get('/audit', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.schoolId, payload.schoolId)).orderBy(desc(auditLogs.createdAt)).limit(100).all();
    const formatted = logs.map(l => {
      const dt = new Date(l.createdAt);
      return {
        id: l.id,
        time: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
        user: l.user,
        action: l.action,
        category: l.category
      };
    });
    return c.json({ auditLog: formatted });
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

// GET /api/admin/config
adminRouter.get('/config', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    let config = await db.select().from(schoolSettings).where(eq(schoolSettings.schoolId, payload.schoolId)).get();
    if (!config) {
      config = {
        schoolId: payload.schoolId,
        language: 'en',
        xpLevelUp: 150,
        xpBadge: 300,
        badgesEnabled: true,
        leaderboardEnabled: true,
        notifyPayment: true,
        notifyPortfolio: true,
        notifyAnnouncement: true,
        dataRetentionYears: 5,
        allowParentMessaging: true,
        allowStudentLeaderboard: true,
        updatedAt: new Date().toISOString()
      };
    }
    return c.json({ config });
  } catch (error: any) {
    console.error('Failed to fetch config:', error);
    return c.json({ error: 'Failed to fetch config' }, 500);
  }
});

// PUT /api/admin/config
adminRouter.put('/config', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const db = getDb(c.env.DB);

  try {
    const existing = await db.select().from(schoolSettings).where(eq(schoolSettings.schoolId, payload.schoolId)).get();

    if (existing) {
      await db.update(schoolSettings).set({
        ...body,
        updatedAt: new Date().toISOString()
      }).where(eq(schoolSettings.schoolId, payload.schoolId));
    } else {
      await db.insert(schoolSettings).values({
        schoolId: payload.schoolId,
        ...body,
        updatedAt: new Date().toISOString()
      });
    }

    const updatedConfig = await db.select().from(schoolSettings).where(eq(schoolSettings.schoolId, payload.schoolId)).get();
    return c.json({ message: 'Configuration updated successfully', config: updatedConfig });
  } catch (error: any) {
    console.error('Failed to update config:', error);
    return c.json({ error: 'Failed to update config' }, 500);
  }
});

// GET /api/admin/fees/structures
adminRouter.get('/fees/structures', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const structures = await db.select().from(feeStructures).where(eq(feeStructures.schoolId, payload.schoolId)).all();
    return c.json({ feeStructures: structures });
  } catch (error: any) {
    console.error('Failed to fetch fee structures:', error);
    return c.json({ error: 'Failed to fetch fee structures' }, 500);
  }
});

// POST /api/admin/fees/structures
adminRouter.post('/fees/structures', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const db = getDb(c.env.DB);
  try {
    const id = crypto.randomUUID();
    await db.insert(feeStructures).values({
      id,
      schoolId: payload.schoolId,
      classId: body.classId,
      term: body.term,
      totalAmount: body.totalAmount,
      breakdown: JSON.stringify(body.breakdown)
    });
    const newStructure = await db.select().from(feeStructures).where(eq(feeStructures.id, id)).get();
    return c.json({ message: 'Fee structure created', feeStructure: newStructure }, 201);
  } catch (error: any) {
    console.error('Failed to create fee structure:', error);
    return c.json({ error: 'Failed to create fee structure' }, 500);
  }
});

// PUT /api/admin/fees/structures/:id
adminRouter.put('/fees/structures/:id', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const db = getDb(c.env.DB);
  try {
    const existing = await db.select().from(feeStructures).where(and(eq(feeStructures.id, id), eq(feeStructures.schoolId, payload.schoolId))).get();
    if (!existing) return c.json({ error: 'Fee structure not found' }, 404);

    await db.update(feeStructures).set({
      classId: body.classId,
      term: body.term,
      totalAmount: body.totalAmount,
      breakdown: JSON.stringify(body.breakdown)
    }).where(eq(feeStructures.id, id));

    const updatedStructure = await db.select().from(feeStructures).where(eq(feeStructures.id, id)).get();
    return c.json({ message: 'Fee structure updated', feeStructure: updatedStructure });
  } catch (error: any) {
    console.error('Failed to update fee structure:', error);
    return c.json({ error: 'Failed to update fee structure' }, 500);
  }
});

// GET /api/admin/payments
adminRouter.get('/payments', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const records = await db.select()
      .from(payments)
      .where(eq(payments.schoolId, payload.schoolId))
      .orderBy(desc(payments.createdAt))
      .all();

    // The frontend expects the format: { id, date, student, parent, amount, method, status, term, ref }
    // Join with studentProfiles to get student name
    const formattedPayments = await Promise.all(records.map(async (p) => {
      let studentName = 'Unknown Student';
      if (p.studentProfileId) {
        const student = await db.select().from(studentProfiles).where(eq(studentProfiles.id, p.studentProfileId)).get();
        if (student) studentName = student.name;
      }
      return {
        id: p.id,
        date: p.date,
        student: studentName,
        parent: p.parentName || 'Unknown Parent',
        amount: p.amount,
        method: p.method,
        status: p.status,
        term: p.term || 'Term 2 2026',
        ref: p.reference
      };
    }));

    return c.json({ payments: formattedPayments });
  } catch (error: any) {
    console.error('Failed to fetch admin payments:', error);
    return c.json({ error: 'Failed to fetch admin payments' }, 500);
  }
});

// --- TIMETABLES ---
adminRouter.get('/timetable', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  try {
    const records = await db.select().from(timetables)
      .where(eq(timetables.schoolId, payload.schoolId))
      .orderBy(desc(timetables.createdAt))
      .limit(1);

    if (records.length === 0) {
      return c.json({ success: true, timetable: null });
    }

    return c.json({ success: true, timetable: records[0] });
  } catch (error) {
    console.error('Failed to fetch timetable:', error);
    return c.json({ error: 'Failed to fetch timetable' }, 500);
  }
});

adminRouter.post('/timetable/generate', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  const body = await c.req.json();
  const { classes, teachers, subjects } = body;

  if (!c.env.AI) {
    return c.json({ error: "Cloudflare Workers AI is not configured" }, 500);
  }

  try {
    const systemPrompt = `You are an expert school scheduler AI. Generate a weekly JSON timetable.
Input Data:
Classes: ${JSON.stringify(classes)}
Teachers: ${JSON.stringify(teachers)}
Subjects: ${JSON.stringify(subjects)}

Output strictly valid JSON with this exact structure (no markdown, no extra text):
{
  "schedule": [
    {
      "day": "Monday",
      "slots": [
        { "time": "08:00 - 09:00", "class": "Grade 4", "subject": "Math", "teacher": "Mr. Smith" }
      ]
    }
  ]
}
Ensure no teacher is assigned to two classes at the same time. Try to distribute subjects evenly.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Generate the timetable." }
      ]
    });

    let generatedJsonText = aiResponse.response || aiResponse.text;
    
    // Clean up potential markdown formatting from AI response
    generatedJsonText = generatedJsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    // Validate JSON
    JSON.parse(generatedJsonText);

    const id = crypto.randomUUID();
    await db.insert(timetables).values({
      id,
      schoolId: payload.schoolId,
      term: 'Term 1', // Example, can be dynamic
      data: generatedJsonText,
      createdAt: new Date().toISOString()
    });

    return c.json({ success: true, message: 'Timetable generated successfully' });
  } catch (error) {
    console.error('Failed to generate timetable:', error);
    return c.json({ error: 'Failed to generate timetable or invalid JSON produced by AI' }, 500);
  }
});

// POST /api/admin/ask-assistant
adminRouter.post('/ask-assistant', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { prompt, metrics } = body;

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  if (!c.env.AI) {
    return c.json({ response: "AI assistant is currently unavailable." });
  }

  try {
    const systemPrompt = `You are a highly formal and professional financial and administrative AI assistant for a school principal at SomoBloom Academy.
You help interpret financial data and student metrics. Here is the current data context:
Students: ${metrics?.totalStudents || 'Unknown'}
Teachers: ${metrics?.totalTeachers || 'Unknown'}
Active Classes: ${metrics?.activeClasses || 'Unknown'}
Total Collected Fees: KES ${metrics?.totalCollected || 0}
Pending Fees: KES ${metrics?.pendingFees || 0}
Failed Payments: ${metrics?.failedPayments || 0}

Base your answers on this data. Be concise, professional, and formal.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const responseText = aiResponse.response || aiResponse.text || "I'm having trouble connecting to my brain right now.";
    return c.json({ response: responseText });
  } catch (err: any) {
    console.error('Failed to run Admin AI:', err);
    return c.json({ error: 'AI Generation failed' }, 500);
  }
});
