import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { getDb } from '../db/client';
import { messages, adminProfiles, teacherProfiles, studentProfiles, parentProfiles, users } from '../db/schema';
import type { JwtPayload } from '../lib/auth';
import { encryptData, decryptData } from '../lib/encryption';
import { eq, or, desc } from 'drizzle-orm';
import type { Bindings } from '../index';

export const messagesRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

const getSecret = (env: Bindings) => {
  if (env.JWT_SECRET) return env.JWT_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_dev_key_123';
};

const getEncryptionSecret = (env: any) => {
  if (env.ENCRYPTION_SECRET) return env.ENCRYPTION_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: ENCRYPTION_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_encryption_key_123';
};

// Apply JWT middleware
messagesRouter.use('/*', (c, next) => {
  const jwtMiddleware = jwt({
    secret: getSecret(c.env),
    alg: 'HS256',
  });
  return jwtMiddleware(c, next);
});

// Helper to find a user's name across all profile tables
async function getUserProfile(db: any, userId: string) {
  // Check Admin
  const admin = await db.select({ name: adminProfiles.name }).from(adminProfiles).where(eq(adminProfiles.userId, userId)).get();
  if (admin) return { name: admin.name, role: 'admin' };

  // Check Teacher
  const teacher = await db.select({ name: teacherProfiles.name }).from(teacherProfiles).where(eq(teacherProfiles.userId, userId)).get();
  if (teacher) return { name: teacher.name, role: 'teacher' };

  // Check Student
  const student = await db.select({ name: studentProfiles.name }).from(studentProfiles).where(eq(studentProfiles.userId, userId)).get();
  if (student) return { name: student.name, role: 'student' };

  // Check Parent
  const parent = await db.select({ name: parentProfiles.name }).from(parentProfiles).where(eq(parentProfiles.userId, userId)).get();
  if (parent) return { name: parent.name, role: 'parent' };

  return { name: 'System User', role: 'unknown' };
}

// Get all messages for the current user (Inbox/Outbox)
messagesRouter.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  const userId = payload.sub;
  const db = getDb(c.env.DB);

  try {
    const rawMessages = await db.select()
      .from(messages)
      .where(or(eq(messages.senderId, userId), eq(messages.receiverId, userId)))
      .orderBy(desc(messages.createdAt))
      .all();

    // Resolve names for senders and receivers
    const encryptionSecret = getEncryptionSecret(c.env);
    
    const enrichedMessages = await Promise.all(rawMessages.map(async (msg: any) => {
      const senderProfile = await getUserProfile(db, msg.senderId);
      const receiverProfile = await getUserProfile(db, msg.receiverId);
      
      const decryptedSubject = msg.subject ? await decryptData(msg.subject, encryptionSecret) : 'No Subject';
      const decryptedContent = msg.content ? await decryptData(msg.content, encryptionSecret) : '';

      return {
        id: msg.id,
        senderId: msg.senderId,
        sender: senderProfile.name,
        senderRole: senderProfile.role,
        receiverId: msg.receiverId,
        receiver: receiverProfile.name,
        receiverRole: receiverProfile.role,
        subject: decryptedSubject,
        text: decryptedContent,
        read: msg.isRead,
        date: msg.createdAt
      };
    }));

    return c.json({ messages: enrichedMessages });
  } catch (err: any) {
    console.error('Failed to fetch messages:', err);
    return c.json({ error: 'Failed to fetch messages' }, 500);
  }
});

// Send a direct message
messagesRouter.post('/', async (c) => {
  const payload = c.get('jwtPayload');
  const senderId = payload.sub;
  const body = await c.req.json();
  const { receiverId, subject, content } = body;

  if (!receiverId || !content) {
    return c.json({ error: 'Receiver ID and content are required' }, 400);
  }

  const db = getDb(c.env.DB);
  try {
    // Verify recipient user exists
    const recipientExists = await db.select({ id: users.id }).from(users).where(eq(users.id, receiverId)).get();
    if (!recipientExists) {
      return c.json({ error: 'Recipient user does not exist' }, 400);
    }

    const messageId = crypto.randomUUID();
    
    // Auto-resolve school ID from sender profile
    let schoolId = '';
    const admin = await db.select({ schoolId: adminProfiles.schoolId }).from(adminProfiles).where(eq(adminProfiles.userId, senderId)).get();
    if (admin) schoolId = admin.schoolId;

    if (!schoolId) {
      const teacher = await db.select({ schoolId: teacherProfiles.schoolId }).from(teacherProfiles).where(eq(teacherProfiles.userId, senderId)).get();
      if (teacher) schoolId = teacher.schoolId;
    }

    if (!schoolId) {
      const student = await db.select({ schoolId: studentProfiles.schoolId }).from(studentProfiles).where(eq(studentProfiles.userId, senderId)).get();
      if (student) schoolId = student.schoolId;
    }

    if (!schoolId) {
      const parent = await db.select({ schoolId: parentProfiles.schoolId }).from(parentProfiles).where(eq(parentProfiles.userId, senderId)).get();
      if (parent) schoolId = parent.schoolId;
    }

    if (!schoolId) {
      return c.json({ error: 'Could not resolve school tenant association for active user' }, 400);
    }
    
    const encryptionSecret = getEncryptionSecret(c.env);
    const encryptedSubject = await encryptData(subject || 'No Subject', encryptionSecret);
    const encryptedContent = await encryptData(content, encryptionSecret);

    await db.insert(messages).values({
      id: messageId,
      schoolId,
      senderId,
      receiverId,
      subject: encryptedSubject,
      content: encryptedContent,
      isRead: false
    });

    const senderProfile = await getUserProfile(db, senderId);
    const receiverProfile = await getUserProfile(db, receiverId);

    return c.json({
      message: 'Message sent successfully',
      sentMessage: {
        id: messageId,
        senderId,
        sender: senderProfile.name,
        senderRole: senderProfile.role,
        receiverId,
        receiver: receiverProfile.name,
        receiverRole: receiverProfile.role,
        subject: subject || 'No Subject',
        text: content,
        read: false,
        date: new Date().toISOString()
      }
    }, 201);
  } catch (err: any) {
    console.error('Failed to send message:', err);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// Mark message as read
messagesRouter.put('/:id/read', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const userId = payload.sub;
  const db = getDb(c.env.DB);

  try {
    const msg = await db.select().from(messages).where(eq(messages.id, id)).get();
    if (!msg) {
      return c.json({ error: 'Message not found' }, 404);
    }

    // Only the recipient can mark a message as read
    if (msg.receiverId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    await db.update(messages).set({ isRead: true }).where(eq(messages.id, id));
    return c.json({ message: 'Message marked as read' });
  } catch (err: any) {
    console.error('Failed to mark message read:', err);
    return c.json({ error: 'Failed to mark message read' }, 500);
  }
});
