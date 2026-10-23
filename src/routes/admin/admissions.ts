import { Hono } from 'hono';
import { getDb } from '../../db/client';
import { users, studentProfiles, parentProfiles, parentStudentRelations, studentEnrollmentSubmissions, classes, enrollments, activityLogs } from '../../db/schema';
import { hashPassword, type JwtPayload } from '../../lib/auth';
import { encryptData, hashIdentifier } from '../../lib/encryption';
import { getEncryptionSecret } from '../../lib/config';
import { eq, and } from 'drizzle-orm';
import { normalizePhoneNumber } from '../../lib/phone';
import { recordAuditLog } from '../../lib/audit';
import type { Bindings } from '../../index';

export const admissionsRouter = new Hono<{ Bindings: Bindings, Variables: { jwtPayload: JwtPayload } }>();

// GET /api/admin/admissions - List all enrollment submissions
admissionsRouter.get('/', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const submissions = await db.select()
      .from(studentEnrollmentSubmissions)
      .where(eq(studentEnrollmentSubmissions.schoolId, payload.schoolId))
      .all();

    return c.json({ enrollments: submissions });
  } catch (error: any) {
    console.error('Failed to fetch admissions:', error);
    return c.json({ error: 'Failed to fetch enrollment submissions' }, 500);
  }
});

// POST /api/admin/admissions/:id/approve - Approve application and auto-provision Student/Parent profiles
admissionsRouter.post('/:id/approve', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);

  try {
    const submissionId = parseInt(id, 10);
    const submission = await db.select()
      .from(studentEnrollmentSubmissions)
      .where(and(
        eq(studentEnrollmentSubmissions.id, submissionId),
        eq(studentEnrollmentSubmissions.schoolId, payload.schoolId)
      ))
      .get();

    if (!submission) {
      return c.json({ error: 'Enrollment submission not found' }, 404);
    }

    if (submission.status === 'approved') {
      return c.json({ error: 'Submission has already been approved' }, 400);
    }

    const fullName = `${submission.firstName || ''} ${submission.lastName || ''}`.trim() || 'Student';
    const studentEmail = submission.email || `student.${submission.admissionNumber || Date.now()}@somobloom.local`;
    const defaultPassword = 'DefaultStudent123!';

    // 1. Prepare Student User & Profile
    const studentEmailHash = await hashIdentifier(studentEmail, encryptionSecret);
    const encStudentEmail = await encryptData(studentEmail, encryptionSecret);
    const hashedStudentPass = await hashPassword(defaultPassword);

    const studentUserId = crypto.randomUUID();
    const studentProfileId = crypto.randomUUID();

    const dbBatchOps: any[] = [
      db.insert(users).values({
        id: studentUserId,
        emailHash: studentEmailHash,
        encryptedEmail: encStudentEmail,
        passwordHash: hashedStudentPass,
      }),
      db.insert(studentProfiles).values({
        id: studentProfileId,
        userId: studentUserId,
        schoolId: payload.schoolId,
        name: fullName,
        studentIdNumber: submission.admissionNumber || `ADM-${submissionId}`,
      }),
      db.update(studentEnrollmentSubmissions)
        .set({ status: 'approved' })
        .where(eq(studentEnrollmentSubmissions.id, submissionId))
    ];

    // 2. If Guardian contact provided, provision Parent User & Profile
    let parentProfileId: string | null = null;
    if (submission.guardianName && (submission.email || submission.phoneNumber)) {
      const normalizedPhone = submission.phoneNumber ? normalizePhoneNumber(submission.phoneNumber) || submission.phoneNumber.trim() : null;
      const parentEmail = submission.email
        ? `parent.${submission.email}`
        : `${(normalizedPhone || Date.now()).toString().replace(/[^0-9]/g, '')}@parent.somobloom.com`;

      const parentEmailHash = await hashIdentifier(parentEmail, encryptionSecret);
      const encParentEmail = await encryptData(parentEmail, encryptionSecret);
      const parentPhoneHash = normalizedPhone ? await hashIdentifier(normalizedPhone, encryptionSecret) : null;
      const encParentPhone = normalizedPhone ? await encryptData(normalizedPhone, encryptionSecret) : null;
      const hashedParentPass = await hashPassword('DefaultParent123!');

      const parentUserId = crypto.randomUUID();
      parentProfileId = crypto.randomUUID();

      dbBatchOps.push(
        db.insert(users).values({
          id: parentUserId,
          emailHash: parentEmailHash,
          encryptedEmail: encParentEmail,
          phoneNumberHash: parentPhoneHash,
          encryptedPhoneNumber: encParentPhone,
          passwordHash: hashedParentPass,
        }),
        db.insert(parentProfiles).values({
          id: parentProfileId,
          userId: parentUserId,
          schoolId: payload.schoolId,
          name: submission.guardianName,
          phoneNumber: normalizedPhone || submission.phoneNumber,
        }),
        db.insert(parentStudentRelations).values({
          parentProfileId,
          studentProfileId,
        })
      );
    }

    // 3. Auto-enroll into class matching target grade if available
    if (submission.gradeApplyingFor) {
      const targetClass = await db.select()
        .from(classes)
        .where(and(
          eq(classes.schoolId, payload.schoolId),
          eq(classes.name, submission.gradeApplyingFor)
        ))
        .get();

      if (targetClass) {
        dbBatchOps.push(
          db.insert(enrollments).values({
            classId: targetClass.id,
            studentProfileId,
          })
        );
      }
    }

    // Log Activity
    dbBatchOps.push(
      db.insert(activityLogs).values({
        id: crypto.randomUUID(),
        schoolId: payload.schoolId,
        user: 'Admin',
        action: 'Admissions Approval',
        detail: `Approved student enrollment for ${fullName} (${submission.admissionNumber || submissionId})`,
        color: '#10b981'
      })
    );

    await (db.batch as any)(dbBatchOps);

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Approved student admission: ${fullName} (Adm: ${submission.admissionNumber || `ADM-${submissionId}`})`,
      category: 'Admissions'
    });

    return c.json({
      message: `Enrollment submission approved successfully. Student profile created.`,
      student: {
        profileId: studentProfileId,
        userId: studentUserId,
        name: fullName,
        admissionNumber: submission.admissionNumber || `ADM-${submissionId}`,
        defaultPassword
      },
      parentCreated: Boolean(parentProfileId)
    }, 200);

  } catch (error: any) {
    console.error('Failed to approve enrollment:', error);
    return c.json({ error: 'Failed to approve enrollment submission' }, 500);
  }
});

// POST /api/admin/admissions/:id/reject - Reject enrollment submission
admissionsRouter.post('/:id/reject', async (c) => {
  const { id } = c.req.param();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);

  try {
    const submissionId = parseInt(id, 10);
    const submission = await db.select()
      .from(studentEnrollmentSubmissions)
      .where(and(
        eq(studentEnrollmentSubmissions.id, submissionId),
        eq(studentEnrollmentSubmissions.schoolId, payload.schoolId)
      ))
      .get();

    if (!submission) {
      return c.json({ error: 'Enrollment submission not found' }, 404);
    }

    await db.update(studentEnrollmentSubmissions)
      .set({ status: 'rejected' })
      .where(eq(studentEnrollmentSubmissions.id, submissionId));

    await db.insert(activityLogs).values({
      id: crypto.randomUUID(),
      schoolId: payload.schoolId,
      user: 'Admin',
      action: 'Admissions Rejection',
      detail: `Rejected enrollment application for ${submission.firstName} ${submission.lastName}`,
      color: '#ef4444'
    });

    await recordAuditLog(db, {
      schoolId: payload.schoolId,
      userId: payload.sub,
      action: `Rejected student admission: ${submission.firstName} ${submission.lastName}`,
      category: 'Admissions'
    });

    return c.json({ message: 'Enrollment application rejected successfully' });
  } catch (error: any) {
    console.error('Failed to reject enrollment:', error);
    return c.json({ error: 'Failed to reject enrollment submission' }, 500);
  }
});
