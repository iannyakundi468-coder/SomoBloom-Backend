import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { teacherProfiles, classes, enrollments, studentProfiles, users, assignments, grades, attendance, portfolioEvidence } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { decryptData } from '../../lib/encryption';
import { eq, and, inArray } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const teacherRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

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
    if (teacherClasses.length === 0) {
      return c.json({ classes: [] });
    }

    const classIds = teacherClasses.map(cls => cls.id);

    // 1. Bulk fetch all enrolled students across all classes
    const allEnrollments = await db.select({
      classId: enrollments.classId,
      id: studentProfiles.id,
      name: studentProfiles.name,
      avatarUrl: studentProfiles.avatarUrl,
      encryptedEmail: users.encryptedEmail
    })
    .from(enrollments)
    .innerJoin(studentProfiles, eq(enrollments.studentProfileId, studentProfiles.id))
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .where(inArray(enrollments.classId, classIds))
    .all();

    // 2. Bulk fetch all attendance logs across all classes
    const allAttendance = await db.select()
      .from(attendance)
      .where(inArray(attendance.classId, classIds))
      .all();

    // 3. Bulk fetch all grades across all classes
    const allGrades = await db.select({
      classId: assignments.classId,
      studentProfileId: grades.studentProfileId,
      score: grades.score,
      feedback: grades.feedback,
      assignmentTitle: assignments.title
    })
    .from(grades)
    .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
    .where(inArray(assignments.classId, classIds))
    .all();

    // Enrich teacher classes completely in-memory using highly-performant JavaScript filters
    const enrichedClasses = await Promise.all(teacherClasses.map(async (cls: any) => {
      const classStudents = allEnrollments.filter((e: any) => e.classId === cls.id);
      const encryptionSecret = getEncryptionSecret(c.env);

      const enrichedStudents = await Promise.all(classStudents.map(async (stu: any) => {
        const decryptedEmail = await decryptData(stu.encryptedEmail, encryptionSecret);
        // Attendance logs for this specific student in this specific class
        const studentLogs = allAttendance.filter((l: any) => l.classId === cls.id && l.studentProfileId === stu.id);
        const total = studentLogs.length;
        const present = studentLogs.filter((l: any) => l.status === 'present').length;

        // Grades for this specific student in this specific class
        const studentGrades = allGrades.filter((g: any) => g.classId === cls.id && g.studentProfileId === stu.id);

        const strands = [
          { name: 'Multiplication', level: 'ME' },
          { name: 'Fractions', level: 'ME' }
        ];

        studentGrades.forEach((g: any) => {
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

        studentGrades.forEach((g: any) => {
          if (competencies[g.assignmentTitle] !== undefined) {
            competencies[g.assignmentTitle] = g.score >= 90 ? 'EE' : g.score >= 70 ? 'ME' : g.score >= 50 ? 'AE' : 'BE';
          }
        });

        return {
          id: stu.id,
          name: stu.name,
          email: decryptedEmail,
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

    let assignmentId: string;
    const existingAssignment = await db.select()
      .from(assignments)
      .where(and(eq(assignments.classId, classId), eq(assignments.title, name)))
      .get();

    if (!existingAssignment) {
      assignmentId = crypto.randomUUID();
      await db.insert(assignments).values({
        id: assignmentId,
        classId,
        title: name,
        description: `CBC Assessment: ${type}`
      });
    } else {
      assignmentId = existingAssignment.id;
    }

    const existingGrade = await db.select()
      .from(grades)
      .where(and(eq(grades.assignmentId, assignmentId), eq(grades.studentProfileId, studentProfileId)))
      .get();

    if (existingGrade) {
      await db.update(grades)
        .set({ score, feedback: `Assessment Level: ${level}` })
        .where(eq(grades.id, existingGrade.id));
    } else {
      const gradeId = crypto.randomUUID();
      await db.insert(grades).values({
        id: gradeId,
        assignmentId,
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

// Generate AI Lesson Plans & Schemes of Work
teacherRouter.post('/ai/generate-plan', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { type, topic, className } = body;

  if (!topic || !type) {
    return c.json({ error: 'Topic and document type are required' }, 400);
  }

  try {
    const isScheme = type === 'scheme';
    const docTitle = isScheme ? `Scheme of Work: ${topic}` : `Lesson Plan: ${topic}`;

    const systemPrompt = isScheme
      ? `You are an expert pedagogical AI assistant specializing in the Kenyan Competency Based Curriculum (CBC). 
         Your task is to generate a comprehensive, highly detailed, and professional Scheme of Work.
         It must follow standard CBC strands, learning outcomes, key inquiry questions, core competencies, learning experiences, and assessment rubrics.
         Format the output beautifully using clean Markdown.`
      : `You are an expert pedagogical AI assistant specializing in the Kenyan Competency Based Curriculum (CBC). 
         Your task is to generate a detailed, structured, and premium Lesson Plan.
         It must specify the lesson objective, time allocations (Introduction, Main Development, Conclusion), learner-centered activities, and a detailed assessment rubric.
         Format the output beautifully using clean Markdown.`;

    const userPrompt = isScheme
      ? `Generate a detailed 3-week Scheme of Work for the topic: "${topic}" ${className ? `for the class "${className}"` : ''}.`
      : `Generate a detailed 40-minute Lesson Plan for the topic: "${topic}" ${className ? `for the class "${className}"` : ''}.`;

    // Execute the Cloudflare Workers AI model natively!
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });

    const content = aiResponse.response || aiResponse.text || 'Failed to generate content.';
    
    return c.json({
      success: true,
      title: docTitle,
      content
    });
  } catch (err: any) {
    console.error('Failed to run Cloudflare Workers AI:', err);
    return c.json({ error: 'AI Generation failed. Please try again.' }, 500);
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

// Fetch all portfolio evidence uploaded by this teacher
teacherRouter.get('/portfolio', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const teacherClasses = await db.select().from(classes).where(eq(classes.teacherProfileId, profile.id)).all();
    if (teacherClasses.length === 0) {
      return c.json({ portfolio: [] });
    }

    const classIds = teacherClasses.map(cls => cls.id);
    const items = await db.select().from(portfolioEvidence)
      .where(inArray(portfolioEvidence.classId, classIds))
      .all();

    return c.json({
      portfolio: items.map((item: any) => ({
        ...item,
        tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch teacher portfolio:', error);
    return c.json({ error: 'Failed to fetch portfolio evidence' }, 500);
  }
});

// Upload student portfolio evidence (Cloudflare R2 + D1 Database)
teacherRouter.post('/portfolio/upload', async (c) => {
  if (!c.env.BUCKET) {
    return c.json({ error: 'R2 storage is currently unavailable' }, 500);
  }

  try {
    const formData = await c.req.parseBody();
    const file = formData['file'];
    const title = formData['title'] as string;
    const type = formData['type'] as string;
    const classId = formData['classId'] as string;
    const studentProfileId = formData['studentProfileId'] as string;
    const tags = formData['tags'] as string || '';
    const description = formData['description'] as string || '';

    if (!file || !title || !classId || !studentProfileId) {
      return c.json({ error: 'Missing required upload fields' }, 400);
    }

    if (!(file instanceof File)) {
      return c.json({ error: 'Invalid file upload' }, 400);
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileKey = `${crypto.randomUUID()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    
    await c.env.BUCKET.put(fileKey, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/jpeg',
      }
    });

    const db = getDb(c.env.DB);
    const evidenceId = crypto.randomUUID();
    const imageUrl = `/api/media/${fileKey}`;

    await db.insert(portfolioEvidence).values({
      id: evidenceId,
      classId,
      studentProfileId,
      title,
      type,
      description,
      imageUrl,
      tags
    });

    return c.json({
      message: 'Portfolio evidence uploaded successfully',
      item: {
        id: evidenceId,
        title,
        type,
        classId,
        studentProfileId,
        imageUrl,
        tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
    }, 201);
  } catch (error: any) {
    console.error('Failed to upload portfolio evidence:', error);
    return c.json({ error: error.message || 'Failed to upload portfolio evidence' }, 500);
  }
});

