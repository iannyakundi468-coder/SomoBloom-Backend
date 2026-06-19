import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../../db/client';
import { parentProfiles, studentProfiles, parentStudentRelations, grades, assignments, announcements, classes, teacherProfiles, enrollments, portfolioEvidence, payments, feeStructures } from '../../db/schema';
import type { JwtPayload } from '../../lib/auth';
import { eq, and, or, desc } from 'drizzle-orm';
import type { Bindings } from '../../index';

export const parentRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

// Apply JWT middleware
parentRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Middleware to ensure the user is a parent
parentRouter.use('/*', async (c, next) => {
  const payload = c.get('jwtPayload');
  if (payload.role !== 'parent') {
    return c.json({ error: 'Unauthorized: Parent access required' }, 403);
  }
  await next();
});

parentRouter.get('/ping', (c) => c.json({ message: 'Parent API operational' }));

// Fetch Parent Profile
parentRouter.get('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  
  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }
  return c.json({ profile });
});

// Fetch Announcements for Parents
parentRouter.get('/announcements', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const rawAnnouncements = await db.select()
      .from(announcements)
      .where(or(eq(announcements.targetAudience, 'parents'), eq(announcements.targetAudience, 'all')))
      .all();

    const formatted = rawAnnouncements.map((ann: any) => ({
      id: ann.id,
      title: ann.title,
      details: ann.content,
      date: ann.createdAt.split('T')[0]
    }));

    return c.json({ announcements: formatted });
  } catch (err: any) {
    console.error('Failed to fetch announcements:', err);
    return c.json({ error: 'Failed to fetch announcements' }, 500);
  }
});

// List linked students (children)
parentRouter.get('/students', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const linkedStudents = await db.select({
    id: studentProfiles.id,
    name: studentProfiles.name,
    studentIdNumber: studentProfiles.studentIdNumber
  })
  .from(parentStudentRelations)
  .innerJoin(studentProfiles, eq(parentStudentRelations.studentProfileId, studentProfiles.id))
  .where(eq(parentStudentRelations.parentProfileId, profile.id))
  .all();

  // Enrich children with class and teacher details
  const enrichedStudents = await Promise.all(linkedStudents.map(async (student: any) => {
    const studentEnrollment = await db.select({
      classId: classes.id,
      className: classes.name,
      teacherProfileId: classes.teacherProfileId,
      teacherName: teacherProfiles.name,
      teacherUserId: teacherProfiles.userId
    })
    .from(enrollments)
    .innerJoin(classes, eq(enrollments.classId, classes.id))
    .innerJoin(teacherProfiles, eq(classes.teacherProfileId, teacherProfiles.id))
    .where(eq(enrollments.studentProfileId, student.id))
    .get();

    return {
      ...student,
      grade: studentEnrollment?.className || 'Unassigned Grade',
      teacherName: studentEnrollment?.teacherName || 'No Teacher Assigned',
      teacherUserId: studentEnrollment?.teacherUserId || null
    };
  }));

  return c.json({ students: enrichedStudents });
});

// Fetch grades for a specific child
parentRouter.get('/students/:studentId/grades', async (c) => {
  const { studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // Ensure this parent is linked to this student
  const relation = await db.select().from(parentStudentRelations)
    .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
    .get();

  if (!relation) {
    return c.json({ error: 'Not authorized to view this student\'s grades' }, 403);
  }

  const studentGrades = await db.select({
    id: grades.id,
    score: grades.score,
    feedback: grades.feedback,
    assignmentTitle: assignments.title,
    classId: assignments.classId
  })
  .from(grades)
  .innerJoin(assignments, eq(grades.assignmentId, assignments.id))
  .where(eq(grades.studentProfileId, studentId))
  .all();

  return c.json({ grades: studentGrades });
});

// Update Parent Profile
parentRouter.put('/me', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { name, avatarUrl } = body;

  const db = getDb(c.env.DB);
  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    await db.update(parentProfiles).set({
      name: name || profile.name,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : profile.avatarUrl
    }).where(eq(parentProfiles.userId, payload.sub));

    return c.json({ message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Failed to update parent profile:', error);
    return c.json({ error: 'Failed to update parent profile' }, 500);
  }
});

// Fetch portfolio evidence for a specific child (Cloudflare D1 Database)
parentRouter.get('/students/:studentId/portfolio', async (c) => {
  const { studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    // Ensure this parent is linked to this student
    const relation = await db.select().from(parentStudentRelations)
      .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
      .get();

    if (!relation) {
      return c.json({ error: 'Not authorized to view this student\'s portfolio' }, 403);
    }

    const items = await db.select().from(portfolioEvidence)
      .where(eq(portfolioEvidence.studentProfileId, studentId))
      .all();

    return c.json({
      portfolio: items.map((item: any) => ({
        ...item,
        tags: item.tags ? item.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []
      }))
    });
  } catch (error: any) {
    console.error('Failed to fetch parent child portfolio:', error);
    return c.json({ error: 'Failed to fetch child portfolio evidence' }, 500);
  }
});

// Fetch student fees
parentRouter.get('/students/:studentId/fees', async (c) => {
  const { studentId } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const relation = await db.select().from(parentStudentRelations)
      .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
      .get();
    if (!relation) return c.json({ error: 'Not authorized' }, 403);

    const enrollment = await db.select().from(enrollments)
      .where(eq(enrollments.studentProfileId, studentId))
      .get();
    
    let totalBalance = 0;
    let breakdown: any[] = [];

    if (enrollment) {
      const feeStruct = await db.select().from(feeStructures)
        .where(and(eq(feeStructures.classId, enrollment.classId), eq(feeStructures.term, 'Term 2 2026')))
        .get();
      
      if (feeStruct) {
        totalBalance = feeStruct.totalAmount;
        try {
          breakdown = JSON.parse(feeStruct.breakdown);
        } catch (e) {
          console.error('Failed to parse breakdown:', e);
        }
      }
    }

    const studentPayments = await db.select()
      .from(payments)
      .where(and(eq(payments.studentProfileId, studentId), eq(payments.status, 'successful')))
      .orderBy(desc(payments.createdAt))
      .all();

    const paidAmount = studentPayments.reduce((acc, p) => acc + p.amount, 0);
    const currentBalance = Math.max(0, totalBalance - paidAmount);

    const history = studentPayments.map(p => ({
      id: p.id,
      date: p.date,
      ref: p.reference,
      amount: p.amount,
      method: p.method,
      status: 'Paid'
    }));

    return c.json({
      fees: {
        totalBalance: currentBalance,
        paidAmount,
        currency: 'KES',
        breakdown,
        history
      }
    });
  } catch (error: any) {
    console.error('Failed to fetch fees:', error);
    return c.json({ error: 'Failed to fetch fees' }, 500);
  }
});

// Submit a payment
parentRouter.post('/payments', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { studentId, amount, method } = body;
  const db = getDb(c.env.DB);

  try {
    const profile = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, payload.sub)).get();
    if (!profile) return c.json({ error: 'Profile not found' }, 404);

    const relation = await db.select().from(parentStudentRelations)
      .where(and(eq(parentStudentRelations.parentProfileId, profile.id), eq(parentStudentRelations.studentProfileId, studentId)))
      .get();
    if (!relation) return c.json({ error: 'Not authorized' }, 403);

    const paymentId = crypto.randomUUID();
    const ref = `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const dt = new Date().toISOString().split('T')[0];

    await db.insert(payments).values({
      id: paymentId,
      schoolId: profile.schoolId,
      studentProfileId: studentId,
      parentName: profile.name,
      amount: parseFloat(amount),
      method: method === 'mpesa' ? 'Mobile Money (M-PESA)' : method === 'card' ? 'Credit/Debit Card' : 'Bank Transfer',
      status: 'successful',
      term: 'Term 2 2026',
      reference: ref,
      date: dt
    });

    return c.json({ message: 'Payment recorded successfully' });
  } catch (error: any) {
    console.error('Failed to submit payment:', error);
    return c.json({ error: 'Failed to submit payment' }, 500);
  }
});

// POST /api/parent/ask-assistant
parentRouter.post('/ask-assistant', async (c) => {
  const payload = c.get('jwtPayload');
  const body = await c.req.json();
  const { prompt, childData } = body;

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  if (!c.env.AI) {
    return c.json({ response: "AI assistant is currently unavailable." });
  }

  try {
    const childName = childData?.name || 'your child';
    const balance = childData?.fees?.totalBalance || 0;
    const progress = childData?.progress ? JSON.stringify(childData.progress) : 'No progress data available';

    const systemPrompt = `You are a highly formal, polite, and professional parent AI assistant for SomoBloom Academy.
You help parents interpret their child's progress, grades, and fee balances.
Here is the context for the current child (${childName}):
Fee Balance: KES ${balance}
Current Academic Progress: ${progress}

Base your answers on this data. Be concise, polite, and formal.`;

    const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const responseText = aiResponse.response || aiResponse.text || "I'm having trouble connecting to my brain right now.";
    return c.json({ response: responseText });
  } catch (err: any) {
    console.error('Failed to run Parent AI:', err);
    return c.json({ error: 'AI Generation failed' }, 500);
  }
});
