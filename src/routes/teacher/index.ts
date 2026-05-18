import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { teacherProfiles, classes, enrollments, studentProfiles, users, assignments, grades, attendance } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const teacherRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => env.JWT_SECRET || 'somobloom_super_secret_dev_key_123';

// Apply JWT middleware
teacherRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a teacher
teacherRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'teacher') {
    return c.json({ error: 'Unauthorized: Teacher access required' }, 403);
  }
  await next();
});

teacherRouter.get('/ping', (c) => c.json({ message: 'Teacher API operational' }));

// Fetch Teacher Profile
teacherRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// List classes for the teacher, enriched with student rosters, grades, and attendance metrics
teacherRouter.get('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const teacherClasses = await db.select().from(classes).where(eq(classes.teacherProfileId, profile.id)).all();

    const enrichedClasses = await Promise.all(teacherClasses.map(async (cls: any) => {
      // Fetch enrolled students
      const enrolled = await db.select({
        id: studentProfiles.id,
        name: studentProfiles.name,
        avatarUrl: studentProfiles.avatarUrl,
        email: users.email
      })
      .from(enrollments)
      .innerJoin(studentProfiles, eq(enrollments.studentProfileId, studentProfiles.id))
      .innerJoin(users, eq(studentProfiles.userId, users.id))
      .where(eq(enrollments.classId, cls.id))
      .all();

      // Enrich each student with attendance metrics and CBC grades
      const enrichedStudents = await Promise.all(enrolled.map(async (stu: any) => {
        // 1. Calculate attendance percentages
        const logs = await db.select()
          .from(attendance)
          .where(and(eq(attendance.classId, cls.id), eq(attendance.studentProfileId, stu.id)))
          .all();

        const total = logs.length;
        const present = logs.filter((l: any) => l.status === 'present').length;

        // 2. Fetch assessments (grades)
        const classGrades = await db.select({
          score: grades.score,
          feedback: grades.feedback,
          assignmentTitle: assignments.title
        })
        .from(grades)
        .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
        .where(and(eq(assignments.classId, cls.id), eq(grades.studentProfileId, stu.id)))
        .all();

        // Convert assignment scores (grades) to strands/competencies or default
        const strands = [
          { name: 'Multiplication', level: 'ME' },
          { name: 'Fractions', level: 'ME' }
        ];

        classGrades.forEach((g: any) => {
          const matchingStrand = strands.find(s => s.name.toLowerCase() === g.assignmentTitle.toLowerCase());
          if (matchingStrand) {
            matchingStrand.level = g.score >= 90 ? 'EE' : g.score >= 70 ? 'ME' : g.score >= 50 ? 'AE' : 'BE';
          }
        });

        const competencies: Record<string, string> = {
          'Critical Thinking': 'ME',
          'Communication': 'EE',
          'Collaboration': 'ME'
        };

        classGrades.forEach((g: any) => {
          if (competencies[g.assignmentTitle] !== undefined) {
            competencies[g.assignmentTitle] = g.score >= 90 ? 'EE' : g.score >= 70 ? 'ME' : g.score >= 50 ? 'AE' : 'BE';
          }
        });

        return {
          id: stu.id,
          name: stu.name,
          email: stu.email,
          avatarUrl: stu.avatarUrl,
          status: 'active',
          portfolioCount: 3,
          attendance: { present, total },
          cbcAssessments: { strands, competencies }
        };
      }));

      return {
        id: cls.id,
        name: cls.name,
        grade: cls.name,
        term: 'Term 2',
        role: 'home',
        students: enrichedStudents
      };
    }));

    return c.json({ classes: enrichedClasses });
  } catch (err: any) {
    console.error('Failed to fetch enriched teacher classes:', err);
    return c.json({ error: 'Failed to fetch teacher classes' }, 500);
  }
});

// Save daily student attendance logs
teacherRouter.post('/classes/:classId/attendance', async (c) => {
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { studentProfileId, isPresent } = body;

  if (!studentProfileId || isPresent === undefined) {
    return c.json({ error: 'Student Profile ID and status are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const logId = crypto.randomUUID();
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    const existing = await db.select()
      .from(attendance)
      .where(and(
        eq(attendance.classId, classId),
        eq(attendance.studentProfileId, studentProfileId),
        eq(attendance.date, todayStr)
      ))
      .get();

    if (existing) {
      await db.update(attendance)
        .set({ status: isPresent ? 'present' : 'absent' })
        .where(eq(attendance.id, existing.id));
      return c.json({ message: 'Attendance updated successfully' });
    } else {
      await db.insert(attendance).values({
        id: logId,
        classId,
        studentProfileId,
        date: todayStr,
        status: isPresent ? 'present' : 'absent'
      });
      return c.json({ message: 'Attendance logged successfully' }, 201);
    }
  } catch (error: any) {
    console.error('Failed to log attendance:', error);
    return c.json({ error: 'Failed to log attendance' }, 500);
  }
});

// Save or update student CBC assessments
teacherRouter.post('/classes/:classId/assessments', async (c) => {
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { studentProfileId, type, name, level } = body;

  if (!studentProfileId || !type || !name || !level) {
    return c.json({ error: 'All fields are required' }, 400);
  }

  const db = getDb(c.env.DB);

  try {
    const levelScoreMap: Record<string, number> = {
      EE: 95,
      ME: 80,
      AE: 60,
      BE: 40
    };
    const score = levelScoreMap[level] || 80;

    let assignment = await db.select()
      .from(assignments)
      .where(and(eq(assignments.classId, classId), eq(assignments.title, name)))
      .get();

    if (!assignment) {
      const assignmentId = crypto.randomUUID();
      await db.insert(assignments).values({
        id: assignmentId,
        classId,
        title: name,
        description: `CBC Assessment: ${type}`
      });
      assignment = { id: assignmentId };
    }

    const existingGrade = await db.select()
      .from(grades)
      .where(and(eq(grades.assignmentId, assignment.id), eq(grades.studentProfileId, studentProfileId)))
      .get();

    if (existingGrade) {
      await db.update(grades)
        .set({ score, feedback: `Assessment Level: ${level}` })
        .where(eq(grades.id, existingGrade.id));
    } else {
      const gradeId = crypto.randomUUID();
      await db.insert(grades).values({
        id: gradeId,
        assignmentId: assignment.id,
        studentProfileId,
        score,
        feedback: `Assessment Level: ${level}`
      });
    }

    return c.json({ message: 'CBC assessment updated successfully' });
  } catch (error: any) {
    console.error('Failed to update CBC assessment:', error);
    return c.json({ error: 'Failed to update CBC assessment' }, 500);
  }
});

// Create assignment for a class
teacherRouter.post('/classes/:classId/assignments', async (c) => {
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { title, description, dueDate } = body;

  if (!title) {
    return c.json({ error: 'Title is required' }, 400);
  }

  const db = getDb(c.env.DB);
  const assignmentId = crypto.randomUUID();

  try {
    await db.insert(assignments).values({
      id: assignmentId,
      classId,
      title,
      description,
      dueDate
    });
    return c.json({ message: 'Assignment created successfully', assignment: { id: assignmentId, classId, title } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to create assignment' }, 500);
  }
});

// Grade an assignment
teacherRouter.post('/assignments/:assignmentId/grades', async (c) => {
  const { assignmentId } = c.req.param();
  const body = await c.req.json();
  const { studentProfileId, score, feedback } = body;

  if (!studentProfileId || score === undefined) {
    return c.json({ error: 'Student Profile ID and score are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const gradeId = crypto.randomUUID();

  try {
    await db.insert(grades).values({
      id: gradeId,
      assignmentId,
      studentProfileId,
      score,
      feedback
    });
    return c.json({ message: 'Grade submitted successfully', grade: { id: gradeId, score } }, 201);
  } catch (error: any) {
    return c.json({ error: 'Failed to submit grade' }, 500);
  }
});

// Update Teacher Profile
teacherRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(teacherProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(teacherProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update teacher profile:', error);
    return c.json({ error: 'Failed to update teacher profile' }, 500);
  }
});

