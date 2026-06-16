import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { teacherProfiles, classes, enrollments, studentProfiles, users, assignments, grades, attendance, portfolioEvidence, messages, teacherRemarks, timetables } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { encryptData, decryptData, hashIdentifier } from '../../lib/encryption';
import { eq, and, inArray, desc } from 'drizzle-orm';
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

// Create a new student and enroll them in the class
teacherRouter.post('/classes/:classId/students', async (c) => {
  const payload = c.get('jwtPayload');
  const { classId } = c.req.param();
  const body = await c.req.json();
  const { name, email, password, studentIdNumber } = body;

  if (!name || !email || !password) {
    return c.json({ error: 'Name, email, and password are required' }, 400);
  }

  const db = getDb(c.env.DB);
  
  // Verify that the teacher calling this owns the class
  const teacherProfile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
  if (!teacherProfile) return c.json({ error: 'Teacher profile not found' }, 404);

  const targetClass = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.teacherProfileId, teacherProfile.id))).get();
  if (!targetClass) return c.json({ error: 'Unauthorized: You are not the assigned teacher for this class' }, 403);

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
      }),
      db.insert(enrollments).values({
        classId,
        studentProfileId
      })
    ]);
    return c.json({ message: 'Student created and enrolled successfully', student: { id: studentProfileId, userId, name, email } }, 201);
  } catch (error: any) {
    console.error('Failed to create student:', error);
    return c.json({ error: 'Failed to create student' }, 500);
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

// Generate AI Report Card Feedback and save to database
teacherRouter.post('/ai/generate-feedback', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { studentProfileId, studentName, attendancePercent, strands, competencies } = body;

  if (!studentProfileId || !studentName) {
    return c.json({ error: 'Student Profile ID and Name are required' }, 400);
  }

  const db = getDb(c.env.DB);
  
  try {
    const teacherProfile = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, payload.sub)).get();
    if (!teacherProfile) return c.json({ error: 'Teacher profile not found' }, 404);

    const systemPrompt = `You are a professional, highly observant, and pedagogical teacher writing a report card remark for a student based on the Kenyan CBC curriculum.
You must generate a concise, professional paragraph (3-4 sentences) summarizing the student's performance, highlighting strengths, and providing a gentle area for improvement.
Base your remark on the following data for student ${studentName}:
Attendance Rate: ${attendancePercent || 'Unknown'}%
CBC Strands: ${JSON.stringify(strands || {})}
Core Competencies: ${JSON.stringify(competencies || {})}

Do not include greetings or sign-offs, just the pure remark text.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Please generate the report card remark for ${studentName}.` }
      ]
    });

    const remark = (aiResponse.response || aiResponse.text || `${studentName} is making satisfactory progress in all areas.`).replace(/^"|"$/g, '').trim();

    const remarkId = crypto.randomUUID();
    await db.insert(teacherRemarks).values({
      id: remarkId,
      studentProfileId,
      teacherProfileId: teacherProfile.id,
      remark,
      term: 'Term 1, 2026' // You could make this dynamic
    });

    return c.json({ success: true, remark });
  } catch (err: any) {
    console.error('Failed to generate and save AI feedback:', err);
    return c.json({ error: 'Failed to generate feedback' }, 500);
  }
});

// AI Timetable Analyst
teacherRouter.post('/ai/analyze-timetable', async (c) => {
  const body = await c.req.json();
  const { classes } = body;
  
  if (!c.env.AI) {
    return c.json({ response: "AI Timetable Analyst is currently unavailable." });
  }

  try {
    const classNames = Array.isArray(classes) ? classes.map((cls: any) => cls.name).join(', ') : 'unknown classes';
    const systemPrompt = `You are an expert pedagogical AI Timetable Analyst for a school using the Kenyan CBC curriculum.
You analyze teacher schedules and provide 1 single, concise sentence of actionable advice regarding scheduling, fatigue management, or engagement based on modern pedagogy.
The teacher teaches the following classes: ${classNames}.
Give only the suggestion text, no greeting.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: "Please analyze my timetable and give me a suggestion." }
      ]
    });

    const responseText = aiResponse.response || aiResponse.text || "AI Suggestion: Consider shifting intensive subjects to morning slots for better engagement.";
    return c.json({ response: responseText });
  } catch (err: any) {
    console.error('Failed to run AI Timetable Analyst:', err);
    return c.json({ error: 'AI Generation failed' }, 500);
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

// Send an in-app message
teacherRouter.post('/messages', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { receiverId, subject, content } = body;

  if (!receiverId || !content) {
    return c.json({ error: 'Receiver ID and content are required' }, 400);
  }

  const db = getDb(c.env.DB);
  const messageId = crypto.randomUUID();

  try {
    await db.insert(messages).values({
      id: messageId,
      schoolId: payload.schoolId,
      senderId: payload.sub,
      receiverId,
      subject: subject || 'No Subject',
      content
    });
    return c.json({ message: 'Message sent successfully', messageId }, 201);
  } catch (error: any) {
    console.error('Failed to send message:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// Fetch filtered timetable for teacher
teacherRouter.get('/timetable', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  try {
    // Get the teacher's profile first to get their name
    const [teacher] = await db.select().from(teacherProfiles)
      .where(eq(teacherProfiles.id, payload.profileId))
      .limit(1);

    if (!teacher) {
      return c.json({ error: 'Teacher profile not found' }, 404);
    }
    
    // Decrypt teacher name to match against the timetable JSON
    const teacherName = await decryptData(teacher.nameEncrypted, c.env);

    // Fetch the latest master timetable
    const records = await db.select().from(timetables)
      .where(eq(timetables.schoolId, payload.schoolId))
      .orderBy(desc(timetables.createdAt))
      .limit(1);

    if (records.length === 0 || !records[0].data) {
      return c.json({ success: true, timetable: null });
    }

    const masterTimetable = JSON.parse(records[0].data);
    
    // Filter the timetable to only include slots assigned to this teacher
    const myTimetable = { schedule: [] };
    
    if (masterTimetable.schedule && Array.isArray(masterTimetable.schedule)) {
      myTimetable.schedule = masterTimetable.schedule.map((dayObj: any) => {
        if (!dayObj.slots) return { day: dayObj.day, slots: [] };
        
        // Filter slots where the teacher name loosely matches
        const mySlots = dayObj.slots.filter((slot: any) => {
          return slot.teacher && slot.teacher.toLowerCase().includes(teacherName.toLowerCase());
        });
        
        return {
          day: dayObj.day,
          slots: mySlots
        };
      }).filter((dayObj: any) => dayObj.slots.length > 0); // Optionally only return days with classes
    }

    return c.json({ success: true, timetable: myTimetable });
  } catch (error) {
    console.error('Failed to fetch teacher timetable:', error);
    return c.json({ error: 'Failed to fetch timetable' }, 500);
  }
});
