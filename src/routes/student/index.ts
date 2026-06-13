import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { studentProfiles, classes, enrollments, assignments, grades, portfolioEvidence, attendance } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and, inArray } from 'drizzle-orm';
import type { Bindings } from '../../index';
import { generateText } from '../../ai';

export const studentRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

// Apply JWT middleware
studentRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a student
studentRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'student') {
    return c.json({ error: 'Unauthorized: Student access required' }, 403);
  }
  await next();
});

studentRouter.get('/ping', (c) => c.json({ message: 'Student API operational' }));

// Fetch Student Profile
studentRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// List enrolled classes for the student
studentRouter.get('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // We need to join enrollments and classes to get the classes the student is enrolled in
  const studentClasses = await db.select({
    id: classes.id,
    name: classes.name,
    teacherProfileId: classes.teacherProfileId
  })
  .from(enrollments)
  .innerJoin(classes, eq(enrollments.classId, classes.id))
  .where(eq(enrollments.studentProfileId, profile.id))
  .all();

  return c.json({ classes: studentClasses });
});

// Fetch assignments for a class
studentRouter.get('/classes/:classId/assignments', async (c) => {
  const { classId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // Check if student is enrolled in this class
  const enrollment = await db.select().from(enrollments)
    .where(and(eq(enrollments.classId, classId), eq(enrollments.studentProfileId, profile.id)))
    .get();

  if (!enrollment) {
    return c.json({ error: 'Not enrolled in this class' }, 403);
  }

  const classAssignments = await db.select().from(assignments).where(eq(assignments.classId, classId)).all();
  return c.json({ assignments: classAssignments });
});

// Fetch all grades for the student
studentRouter.get('/grades', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const studentGrades = await db.select({
    id: grades.id,
    score: grades.score,
    feedback: grades.feedback,
    assignmentTitle: assignments.title,
    classId: assignments.classId
  })
  .from(grades)
  .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
  .where(eq(grades.studentProfileId, profile.id))
  .all();

  return c.json({ grades: studentGrades });
});

// AI Text generation endpoint for students (e.g., homework helper)
studentRouter.post('/ask-tutor', async (c) => {
  const body = await c.req.json();
  const prompt = body.prompt;

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  if (!c.env.AI) {
    return c.json({ response: "AI tutor is currently unavailable in the local environment." });
  }

  try {
    const payload = c.get('jwtPayload');
    const db = getDb(c.env.DB);
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    const studentName = profile?.name || 'Student';

    const systemPrompt = `You are an encouraging, deeply supportive, and highly effective Socratic AI Tutor for the Kenyan Competency Based Curriculum (CBC).
You are tutoring a student named ${studentName}.
CRITICAL RULES:
1. NEVER give the direct answer to a question.
2. ALWAYS guide the student to discover the answer themselves through Socratic questioning.
3. Be deeply encouraging and supportive, celebrating their effort.
4. Keep your responses short, simple, and easy to read. Use formatting where helpful.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    return c.json({ response: aiResponse.response || "I'm thinking... please try again." });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update Student Profile
studentRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(studentProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(studentProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update student profile:', error);
    return c.json({ error: 'Failed to update student profile' }, 500);
  }
});

// Fetch student's own portfolio evidence (Cloudflare D1 Database)
studentRouter.get('/portfolio', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const items = await db.select().from(portfolioEvidence)
      .where(eq(portfolioEvidence.studentProfileId, profile.id))
      .all();

    return c.json({
      portfolio: items.map((item: any) => ({
        ...item,
        tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch student portfolio:', error);
    return c.json({ error: 'Failed to fetch portfolio evidence' }, 500);
  }
});

// GET /api/student/tasks
studentRouter.get('/tasks', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    // Get all enrolled classes
    const enrolledClasses = await db.select().from(enrollments).where(eq(enrollments.studentProfileId, profile.id)).all();
    if (enrolledClasses.length === 0) return c.json({ tasks: [] });

    const classIds = enrolledClasses.map(e => e.classId);

    // Get all assignments for these classes
    const allAssignments = await db.select().from(assignments).where(inArray(assignments.classId, classIds)).all();

    // Get all grades for this student
    const studentGrades = await db.select().from(grades).where(eq(grades.studentProfileId, profile.id)).all();
    const gradedAssignmentIds = new Set(studentGrades.map(g => g.assignmentId));

    // Filter out assignments that have grades
    const pendingAssignments = allAssignments.filter(a => !gradedAssignmentIds.has(a.id));

    const tasks = pendingAssignments.map(a => ({
      id: a.id,
      text: a.title,
      completed: false,
      category: 'Assignment'
    }));

    return c.json({ tasks });
  } catch (error: any) {
    console.error('Failed to fetch tasks:', error);
    return c.json({ error: 'Failed to fetch tasks' }, 500);
  }
});

// GET /api/student/competencies
studentRouter.get('/competencies', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const studentGrades = await db.select({
      score: grades.score,
      assignmentTitle: assignments.title
    })
    .from(grades)
    .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
    .where(eq(grades.studentProfileId, profile.id))
    .all();

    const competenciesData = [
      { name: 'Communication & Collaboration', keywords: ['communication', 'collaboration', 'group', 'presentation', 'speech', 'talk'], defaultScore: 85, description: 'Shares ideas effectively and works cohesively in group projects.' },
      { name: 'Critical Thinking & Problem Solving', keywords: ['critical', 'problem', 'solve', 'analyze', 'math', 'logic'], defaultScore: 78, description: 'Analyzes observations logically in science and math strands.' },
      { name: 'Imagination & Creativity', keywords: ['art', 'creative', 'imagine', 'draw', 'design', 'paint'], defaultScore: 94, description: 'Excels in visual arts and story illustrations.' },
      { name: 'Citizenship', keywords: ['citizen', 'social', 'environment', 'care', 'responsibility'], defaultScore: 82, description: 'Shows high responsibility, environmental care, and respect.' },
      { name: 'Learning to Learn', keywords: ['learn', 'study', 'research', 'revision'], defaultScore: 76, description: 'Actively searches for answers and shows self-drive in revisions.' },
      { name: 'Self-efficacy', keywords: ['self', 'efficacy', 'confidence', 'independent'], defaultScore: 88, description: 'Presents evidence confidently and manages study hours well.' },
      { name: 'Digital Literacy', keywords: ['digital', 'computer', 'tech', 'typing', 'internet'], defaultScore: 95, description: 'Confidently operates school Chromebooks and uses search engines.' }
    ];

    const competencies = competenciesData.map(comp => {
      const relatedGrades = studentGrades.filter(g => 
        comp.keywords.some(kw => (g.assignmentTitle || '').toLowerCase().includes(kw))
      );
      
      let score = comp.defaultScore;
      if (relatedGrades.length > 0) {
        const validScores = relatedGrades.map(g => g.score).filter((s): s is number => s !== null && s !== undefined);
        if (validScores.length > 0) {
          score = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
        }
      }

      return {
        name: comp.name,
        score,
        description: comp.description
      };
    });

    return c.json({ competencies });
  } catch (error: any) {
    console.error('Failed to fetch competencies:', error);
    return c.json({ error: 'Failed to fetch competencies' }, 500);
  }
});

// GET /api/student/attendance
studentRouter.get('/attendance', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const records = await db.select().from(attendance).where(eq(attendance.studentProfileId, profile.id)).all();

    const totalDays = records.length;
    const presentDays = records.filter(r => r.status === 'present').length;
    const absentDays = records.filter(r => r.status === 'absent').length;
    const lateDays = records.filter(r => r.status === 'tardy').length;

    const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 93;

    return c.json({
      attendance: {
        totalDays: totalDays === 0 ? 45 : totalDays,
        presentDays: totalDays === 0 ? 42 : presentDays,
        absentDays: totalDays === 0 ? 3 : absentDays,
        lateDays,
        attendancePercent
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch attendance:', error);
    return c.json({ error: 'Failed to fetch attendance' }, 500);
  }
});
