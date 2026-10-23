import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { users, schools, adminProfiles, teacherProfiles, studentProfiles, parentProfiles, classes, parentStudentRelations, enrollments, studentEnrollmentSubmissions, activityLogs, auditLogs, schoolSettings, feeStructures, payments, timetables, announcements, delegatedResponsibilities, subjects, classSubjects } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../../lib/encryption';
import { getJwtSecret, getEncryptionSecret } from '../../lib/config';
import { eq, and, desc, or, like } from 'drizzle-orm';
import { normalizePhoneNumber } from '../../lib/phone';
import { recordAuditLog, getAdminName } from '../../lib/audit';
import type { Bindings } from '../../index';

import { admissionsRouter } from './admissions';

export const adminRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

// 1. Apply JWT middleware to all admin routes
adminRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getJwtSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// 2. Middleware to ensure the user is an admin or a teacher with delegated access
adminRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  
  if (payload.role === 'admin') {
    return await next();
  }
  
  if (payload.role === 'teacher') {
    const path = c.req.path;
    const db = getDb(c.env.DB);
    
    const teacher = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
    if (!teacher) {
      return c.json({ error: 'Unauthorized: Teacher profile not found' }, 403);
    }
    
    const delegations = await db.select().from(delegatedResponsibilities)
      .where(and(
        eq(delegatedResponsibilities.teacherProfileId, teacher.id),
        eq(delegatedResponsibilities.schoolId, payload.schoolId)
      )).all();
      
    const activeResponsibilityTypes = delegations.map(d => d.responsibility);
    
    let requiredResponsibility: 'announcements' | 'admissions' | 'finances' | 'timetable' | null = null;
    if (path.includes('/enrollments') || path.includes('/admissions')) {
      requiredResponsibility = 'admissions';
    } else if (path.includes('/fees') || path.includes('/payments')) {
      requiredResponsibility = 'finances';
    } else if (path.includes('/timetable')) {
      requiredResponsibility = 'timetable';
    } else if (path.includes('/announcements')) {
      requiredResponsibility = 'announcements';
    }
    
    if (requiredResponsibility && activeResponsibilityTypes.includes(requiredResponsibility)) {
      payload.profileId = teacher.id;
      c.set('jwtPayload', payload);
      return await next();
    }
  }
  
  return c.json({ error: 'Unauthorized: Admin access required' }, 403);
});

adminRouter.get('/ping', (c) => c.json({ message: 'Admin API operational' }));

adminRouter.route('/admissions', admissionsRouter);

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
  const { name, email, password, department, phoneNumber, phone } = body;
  const rawPhone = phoneNumber || phone;
  const normalizedPhone = rawPhone ? normalizePhoneNumber(rawPhone) || rawPhone.trim() : null;

  if (!name || (!email && !normalizedPhone) || !password) {
    return c.json({ error: 'Name, password, and phone number (or email) are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);

  const effectiveEmail = email && typeof email === 'string' && email.includes('@')
    ? email.trim()
    : `${(normalizedPhone || Date.now()).toString().replace(/[^0-9]/g, '')}@teacher.somobloom.com`;

  const emailHash = await hashIdentifier(effectiveEmail, encryptionSecret);
  const encryptedEmail = await encryptData(effectiveEmail, encryptionSecret);
  const phoneNumberHash = normalizedPhone ? await hashIdentifier(normalizedPhone, encryptionSecret) : null;
  const encryptedPhoneNumber = normalizedPhone ? await encryptData(normalizedPhone, encryptionSecret) : null;

  // Check if user already exists
  let existingUser;
  if (phoneNumberHash) {
    existingUser = await db.select().from(users).where(or(eq(users.emailHash, emailHash), eq(users.phoneNumberHash, phoneNumberHash))).get();
  } else {
    existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  }

  if (existingUser) {
    return c.json({ error: 'User with this phone number or email already exists' }, 400);
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
        phoneNumberHash,
        encryptedPhoneNumber,
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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Created teacher profile "${name}" (${department || 'General'})`,
      category: 'Users'
    });

    return c.json({
      message: 'Teacher created successfully',
      teacher: {
        id: teacherProfileId,
        userId,
        name,
        department,
        email: email || '',
        phoneNumber: normalizedPhone || rawPhone || ''
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
  const { name, email, password, studentIdNumber, phoneNumber, phone } = body;
  const rawPhone = phoneNumber || phone;
  const normalizedPhone = rawPhone ? normalizePhoneNumber(rawPhone) || rawPhone.trim() : null;

  if (!name || (!email && !normalizedPhone && !studentIdNumber) || !password) {
    return c.json({ error: 'Name, password, and phone number (or email/student ID) are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);

  const effectiveEmail = email && typeof email === 'string' && email.includes('@')
    ? email.trim()
    : `${(studentIdNumber || normalizedPhone || Date.now()).toString().replace(/[^0-9a-zA-Z]/g, '')}@student.somobloom.com`;

  const emailHash = await hashIdentifier(effectiveEmail, encryptionSecret);
  const encryptedEmail = await encryptData(effectiveEmail, encryptionSecret);
  const phoneNumberHash = normalizedPhone ? await hashIdentifier(normalizedPhone, encryptionSecret) : null;
  const encryptedPhoneNumber = normalizedPhone ? await encryptData(normalizedPhone, encryptionSecret) : null;

  let existingUser;
  if (phoneNumberHash) {
    existingUser = await db.select().from(users).where(or(eq(users.emailHash, emailHash), eq(users.phoneNumberHash, phoneNumberHash))).get();
  } else {
    existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  }

  if (existingUser) {
    return c.json({ error: 'User with this phone number or email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        emailHash,
        encryptedEmail,
        phoneNumberHash,
        encryptedPhoneNumber,
        passwordHash: hashedPassword
      }),
      db.insert(studentProfiles).values({
        id: studentProfileId,
        userId,
        schoolId: payload.schoolId,
        name,
        studentIdNumber
      })
    ]);
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Enrolled student "${name}" (Adm: ${studentIdNumber || 'Auto'})`,
      category: 'Users'
    });

    return c.json({
      message: 'Student created successfully',
      student: {
        id: studentProfileId,
        userId,
        name,
        email: email || '',
        phoneNumber: normalizedPhone || rawPhone || '',
        studentIdNumber
      }
    }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create student' }, 500);
  }
});

adminRouter.post('/parents', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, email, password, phoneNumber, phone } = body;
  const rawPhone = phoneNumber || phone;
  const normalizedPhone = rawPhone ? normalizePhoneNumber(rawPhone) || rawPhone.trim() : null;

  if (!name || (!email && !normalizedPhone) || !password) {
    return c.json({ error: 'Name, password, and phone number (or email) are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);

  const effectiveEmail = email && typeof email === 'string' && email.includes('@')
    ? email.trim()
    : `${(normalizedPhone || Date.now()).toString().replace(/[^0-9]/g, '')}@parent.somobloom.com`;

  const emailHash = await hashIdentifier(effectiveEmail, encryptionSecret);
  const encryptedEmail = await encryptData(effectiveEmail, encryptionSecret);
  const phoneNumberHash = normalizedPhone ? await hashIdentifier(normalizedPhone, encryptionSecret) : null;
  const encryptedPhoneNumber = normalizedPhone ? await encryptData(normalizedPhone, encryptionSecret) : null;

  let existingUser;
  if (phoneNumberHash) {
    existingUser = await db.select().from(users).where(or(eq(users.emailHash, emailHash), eq(users.phoneNumberHash, phoneNumberHash))).get();
  } else {
    existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  }

  if (existingUser) {
    return c.json({ error: 'User with this phone number or email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const parentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        emailHash,
        encryptedEmail,
        phoneNumberHash,
        encryptedPhoneNumber,
        passwordHash: hashedPassword
      }),
      db.insert(parentProfiles).values({
        id: parentProfileId,
        userId,
        schoolId: payload.schoolId,
        name,
        phoneNumber: normalizedPhone || rawPhone
      })
    ]);
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Created parent account for "${name}"`,
      category: 'Users'
    });

    return c.json({
      message: 'Parent created successfully',
      parent: {
        id: parentProfileId,
        userId,
        name,
        email: email || '',
        phoneNumber: normalizedPhone || rawPhone || ''
      }
    }, 201);
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
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Created class "${name}"`,
      category: 'Classes'
    });
    return c.json({ message: 'Class created successfully', class: { id: classId, name, teacherProfileId } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create class' }, 500);
  }
});

adminRouter.post('/parents/:parentId/students/:studentId', async (c) => {
  const { parentId, studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    await db.insert(parentStudentRelations).values({
      parentProfileId: parentId,
      studentProfileId: studentId
    });
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Linked student ID ${studentId} to parent ID ${parentId}`,
      category: 'Users'
    });
    return c.json({ message: 'Student linked to parent successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to link student to parent' }, 500);
  }
});

adminRouter.post('/classes/:classId/enrollments', async (c) => {
  const { classId } = c.req.param();
  const payload = c.get('jwtPayload');
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
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Enrolled student ID ${studentProfileId} into class ID ${classId}`,
      category: 'Classes'
    });
    return c.json({ message: 'Student enrolled in class successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to enroll student' }, 500);
  }
});

adminRouter.delete('/classes/:classId/enrollments/:studentId', async (c) => {
  const { classId, studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  try {
    await db.delete(enrollments).where(and(
      eq(enrollments.classId, classId),
      eq(enrollments.studentProfileId, studentId)
    ));
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Unenrolled student ID ${studentId} from class ID ${classId}`,
      category: 'Classes'
    });
    return c.json({ message: 'Student unenrolled from class successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to unenroll student' }, 500);
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

adminRouter.put('/enrollments/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { status } = body;
  const payload = c.get('jwtPayload');

  if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
    return c.json({ error: 'Invalid or missing status' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    const submissionId = parseInt(id, 10);
    const existing = await db.select().from(studentEnrollmentSubmissions)
      .where(and(
        eq(studentEnrollmentSubmissions.id, submissionId),
        eq(studentEnrollmentSubmissions.schoolId, payload.schoolId)
      )).get();

    if (!existing) {
      return c.json({ error: 'Enrollment submission not found' }, 404);
    }

    await db.update(studentEnrollmentSubmissions)
      .set({ status })
      .where(eq(studentEnrollmentSubmissions.id, submissionId));

    return c.json({ message: `Enrollment submission updated to ${status} successfully` });
  } catch (error: any) {
    console.error('Failed to update enrollment:', error);
    return c.json({ error: 'Failed to update enrollment submission' }, 500);
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
      encryptedPhoneNumber: users.encryptedPhoneNumber,
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
      encryptedPhoneNumber: users.encryptedPhoneNumber,
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
      encryptedPhoneNumber: users.encryptedPhoneNumber,
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
      encryptedPhoneNumber: users.encryptedPhoneNumber,
      createdAt: parentProfiles.createdAt,
      phoneNumber: parentProfiles.phoneNumber,
    })
    .from(parentProfiles)
    .innerJoin(users, eq(parentProfiles.userId, users.id))
    .where(eq(parentProfiles.schoolId, payload.schoolId))
    .all();

    const parentRelations = await db.select().from(parentStudentRelations).all();
    
    const parentsWithChildren = parents.map(p => {
      const childrenIds = parentRelations.filter(r => r.parentProfileId === p.id).map(r => r.studentProfileId);
      return { ...p, children: childrenIds };
    });

    const encryptionSecret = getEncryptionSecret(c.env);

    const decryptUserDetails = async (u: any) => {
      let email = '';
      let phoneNumber = u.phoneNumber || '';

      try {
        if (u.encryptedEmail) {
          const dec = await decryptData(u.encryptedEmail, encryptionSecret);
          if (!dec.endsWith('.somobloom.com') && !dec.endsWith('.somobloom.local')) {
            email = dec;
          }
        }
      } catch (err) {
        console.warn(`[admin] Failed to decrypt email for user ${u.id}:`, err);
      }

      try {
        if (!phoneNumber && u.encryptedPhoneNumber) {
          phoneNumber = await decryptData(u.encryptedPhoneNumber, encryptionSecret);
        }
      } catch (err) {
        console.warn(`[admin] Failed to decrypt phone for user ${u.id}:`, err);
      }

      const { encryptedEmail, encryptedPhoneNumber, ...rest } = u;
      return {
        ...rest,
        email,
        phoneNumber,
        primaryContact: phoneNumber || email || ''
      };
    };

    const combinedUsers = await Promise.all([
      ...admins.map(a => ({ ...a, role: 'admin', status: 'active' })),
      ...teachers.map(t => ({ ...t, role: 'teacher', status: 'active' })),
      ...students.map(s => ({ ...s, role: 'student', status: 'active' })),
      ...parentsWithChildren.map(p => ({ ...p, role: 'parent', status: 'active' }))
    ].map(decryptUserDetails));

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
        students: classEnrollments,
        status: 'active',
        capacity: 30
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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Updated user profile "${name || id}"`,
      category: 'Users'
    });

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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Deleted user profile ID: ${id}`,
      category: 'Users'
    });

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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Updated class "${name || classItem.name}"`,
      category: 'Classes'
    });

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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Deleted class "${cls.name}" (ID: ${id})`,
      category: 'Classes'
    });

    return c.json({ message: 'Class deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete class:', error);
    return c.json({ error: 'Failed to delete class' }, 500);
  }
});

// --- SUBJECTS CRUD ---
// GET /api/admin/subjects
adminRouter.get('/subjects', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const list = await db.select().from(subjects).where(eq(subjects.schoolId, payload.schoolId)).all();
    return c.json({ subjects: list });
  } catch (error: any) {
    return c.json({ error: 'Failed to fetch subjects' }, 500);
  }
});

// POST /api/admin/subjects
adminRouter.post('/subjects', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, code } = body;
  if (!name) return c.json({ error: 'Name is required' }, 400);

  const db = getDb(c.env.DB);
  const id = crypto.randomUUID();
  try {
    await db.insert(subjects).values({ id, schoolId: payload.schoolId, name, code });
    const newSubject = await db.select().from(subjects).where(eq(subjects.id, id)).get();
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Created curriculum subject "${name}" (${code || 'CBC'})`,
      category: 'Academics'
    });
    return c.json({ message: 'Subject created', subject: newSubject }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create subject' }, 500);
  }
});

// PUT /api/admin/subjects/:id
adminRouter.put('/subjects/:id', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, code } = body;

  const db = getDb(c.env.DB);
  try {
    const existing = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.schoolId, payload.schoolId))).get();
    if (!existing) return c.json({ error: 'Subject not found' }, 404);

    await db.update(subjects).set({
      name: name || existing.name,
      code: code !== undefined ? code : existing.code
    }).where(eq(subjects.id, id));

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Updated curriculum subject "${name || existing.name}"`,
      category: 'Academics'
    });

    return c.json({ message: 'Subject updated successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to update subject' }, 500);
  }
});

// DELETE /api/admin/subjects/:id
adminRouter.delete('/subjects/:id', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const existing = await db.select().from(subjects).where(and(eq(subjects.id, id), eq(subjects.schoolId, payload.schoolId))).get();
    if (!existing) return c.json({ error: 'Subject not found' }, 404);

    await db.batch([
      db.delete(classSubjects).where(eq(classSubjects.subjectId, id)),
      db.delete(subjects).where(eq(subjects.id, id))
    ]);

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Deleted curriculum subject "${existing.name}" (ID: ${id})`,
      category: 'Academics'
    });

    return c.json({ message: 'Subject deleted successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to delete subject' }, 500);
  }
});

// --- CLASS SUBJECTS ---
// POST /api/admin/classes/:classId/subjects
adminRouter.post('/classes/:classId/subjects', async (c) => {
  const { classId } = c.req.param();
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { subjectId, teacherProfileId } = body;

  if (!subjectId) return c.json({ error: 'subjectId is required' }, 400);

  const db = getDb(c.env.DB);
  try {
    await db.insert(classSubjects).values({ classId, subjectId, teacherProfileId });
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Assigned subject ID ${subjectId} to class ID ${classId}`,
      category: 'Academics'
    });
    return c.json({ message: 'Subject assigned to class successfully' }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to assign subject to class' }, 500);
  }
});

// DELETE /api/admin/classes/:classId/subjects/:subjectId
adminRouter.delete('/classes/:classId/subjects/:subjectId', async (c) => {
  const { classId, subjectId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    await db.delete(classSubjects).where(and(eq(classSubjects.classId, classId), eq(classSubjects.subjectId, subjectId)));
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Removed subject ID ${subjectId} from class ID ${classId}`,
      category: 'Academics'
    });
    return c.json({ message: 'Subject removed from class successfully' });
  } catch (error: any) {
    return c.json({ error: 'Failed to remove subject from class' }, 500);
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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      user: name || profile.name,
      action: `Updated administrator profile details`,
      category: 'Security'
    });

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
    const categoryQuery = c.req.query('category');
    const searchQuery = c.req.query('search') || c.req.query('q');
    const limitQuery = parseInt(c.req.query('limit') || '150', 10);
    const limit = Math.min(Math.max(isNaN(limitQuery) ? 150 : limitQuery, 1), 500);

    const conditions = [eq(auditLogs.schoolId, payload.schoolId)];
    if (categoryQuery && categoryQuery !== 'All') {
      conditions.push(eq(auditLogs.category, categoryQuery));
    }
    if (searchQuery && searchQuery.trim()) {
      const q = `%${searchQuery.trim()}%`;
      conditions.push(or(
        like(auditLogs.action, q),
        like(auditLogs.user, q),
        like(auditLogs.category, q)
      )!);
    }

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .all();

    const formatted = logs.map(l => {
      let timeStr = l.createdAt;
      try {
        const dt = new Date(l.createdAt);
        if (!isNaN(dt.getTime())) {
          timeStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        }
      } catch (e) {}

      return {
        id: l.id,
        time: timeStr,
        user: l.user,
        action: l.action,
        category: l.category
      };
    });

    return c.json({ auditLog: formatted, total: formatted.length });
  } catch (error: any) {
    console.error('Failed to fetch audit logs:', error);
    return c.json({ error: 'Failed to fetch audit logs' }, 500);
  }
});

// POST /api/admin/audit
adminRouter.post('/audit', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const body = await c.req.json();
    const { action, category } = body;
    if (!action || typeof action !== 'string') {
      return c.json({ error: 'Action description is required' }, 400);
    }

    const adminName = await getAdminName(db, payload.sub);
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      user: adminName,
      userId: payload.sub,
      action: action.trim(),
      category: category || 'General'
    });

    return c.json({ message: 'Audit entry recorded successfully' }, 201);
  } catch (error: any) {
    console.error('Failed to record audit entry:', error);
    return c.json({ error: 'Failed to record audit entry' }, 500);
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
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Updated school system configuration settings`,
      category: 'Settings'
    });
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
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Created fee structure for "${body.term || 'Term'}" (KES ${body.totalAmount || 0})`,
      category: 'Finance'
    });
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
    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Updated fee structure for "${body.term || existing.term}" (KES ${body.totalAmount ?? existing.totalAmount})`,
      category: 'Finance'
    });
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

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Regenerated school timetable schedules via AI scheduler`,
      category: 'Timetable'
    });

    return c.json({ success: true, message: 'Timetable generated successfully' });
  } catch (error) {
    console.error('Failed to generate timetable:', error);
    return c.json({ error: 'Failed to generate timetable or invalid JSON produced by AI' }, 500);
  }
});

// GET /api/admin/announcements
adminRouter.get('/announcements', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const list = await db.select().from(announcements)
      .where(eq(announcements.schoolId, payload.schoolId))
      .orderBy(desc(announcements.createdAt))
      .all();
    return c.json({ announcements: list });
  } catch (error: any) {
    console.error('Failed to fetch announcements:', error);
    return c.json({ error: 'Failed to fetch announcements' }, 500);
  }
});

// POST /api/admin/announcements
adminRouter.post('/announcements', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { title, content, targetAudience } = body;

  if (!title || !content || !targetAudience) {
    return c.json({ error: 'Title, content, and targetAudience are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const announcementId = crypto.randomUUID();

  try {
    await db.insert(announcements).values({
      id: announcementId,
      schoolId: payload.schoolId,
      authorProfileId: payload.profileId || payload.sub,
      title,
      content,
      targetAudience
    });

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Broadcasted announcement "${title}" (Target: ${targetAudience})`,
      category: 'Announcements'
    });

    return c.json({ message: 'Announcement created successfully', announcementId }, 201);
  } catch (error: any) {
    console.error('Failed to create announcement:', error);
    return c.json({ error: 'Failed to create announcement' }, 500);
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
    const db = getDb(c.env.DB);
    const school = await db.select().from(schools).where(eq(schools.id, payload.schoolId)).get();
    const schoolName = school?.name || 'the school';
    const systemPrompt = `You are a highly formal and professional financial and administrative AI assistant for a school principal at ${schoolName}.
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

// GET /admin/delegations
adminRouter.get('/delegations', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const delegations = await db.select().from(delegatedResponsibilities)
      .where(eq(delegatedResponsibilities.schoolId, payload.schoolId))
      .all();
    return c.json({ delegations });
  } catch (error: any) {
    console.error('Failed to fetch delegations:', error);
    return c.json({ error: 'Failed to fetch delegations' }, 500);
  }
});

// POST /admin/delegations/toggle
adminRouter.post('/delegations/toggle', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { teacherProfileId, responsibility } = body;

  if (!teacherProfileId || !responsibility) {
    return c.json({ error: 'teacherProfileId and responsibility are required' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    // Check if the delegation already exists
    const existing = await db.select().from(delegatedResponsibilities)
      .where(and(
        eq(delegatedResponsibilities.schoolId, payload.schoolId),
        eq(delegatedResponsibilities.teacherProfileId, teacherProfileId),
        eq(delegatedResponsibilities.responsibility, responsibility)
      )).get();

    if (existing) {
      // Revoke delegation
      await db.delete(delegatedResponsibilities)
        .where(eq(delegatedResponsibilities.id, existing.id));
    } else {
      // Add delegation
      await db.insert(delegatedResponsibilities).values({
        id: crypto.randomUUID(),
        schoolId: payload.schoolId,
        teacherProfileId,
        responsibility
      });
    }

    // Return updated list of delegations
    const delegations = await db.select().from(delegatedResponsibilities)
      .where(eq(delegatedResponsibilities.schoolId, payload.schoolId))
      .all();

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `${existing ? 'Revoked' : 'Granted'} delegated responsibility "${responsibility}" for teacher profile ID ${teacherProfileId}`,
      category: 'Security'
    });

    return c.json({ delegations });
  } catch (error: any) {
    console.error('Failed to toggle delegation:', error);
    return c.json({ error: 'Failed to toggle delegation' }, 500);
  }
});

