import { eq } from 'drizzle-orm';
import { auditLogs, adminProfiles, teacherProfiles, studentProfiles, classes, assignments } from '../db/schema';

export type AuditCategory =
  | 'Users'
  | 'Classes'
  | 'Academics'
  | 'Grading'
  | 'Attendance'
  | 'Portfolio'
  | 'Settings'
  | 'Finance'
  | 'Admissions'
  | 'Security'
  | 'Timetable'
  | 'Announcements'
  | 'General';

export interface RecordAuditParams {
  schoolId: string;
  user?: string;
  userId?: string;
  action: string;
  category: AuditCategory;
  createdAt?: string;
}

/**
 * Look up administrator's display name from adminProfiles if available
 */
export async function getAdminName(db: any, userId?: string): Promise<string> {
  if (!userId) return 'System Administrator';
  try {
    const admin = await db
      .select({ name: adminProfiles.name })
      .from(adminProfiles)
      .where(eq(adminProfiles.userId, userId))
      .get();
    return admin?.name || 'Administrator';
  } catch {
    return 'Administrator';
  }
}

/**
 * Look up teacher's display name from teacherProfiles if available
 */
export async function getTeacherName(db: any, userId?: string): Promise<string> {
  if (!userId) return 'Teacher';
  try {
    const teacher = await db
      .select({ name: teacherProfiles.name })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, userId))
      .get();
    return teacher?.name || 'Teacher';
  } catch {
    return 'Teacher';
  }
}

/**
 * Look up student's display name from studentProfiles
 */
export async function getStudentName(db: any, studentProfileId?: string): Promise<string> {
  if (!studentProfileId) return 'Student';
  try {
    const student = await db
      .select({ name: studentProfiles.name })
      .from(studentProfiles)
      .where(eq(studentProfiles.id, studentProfileId))
      .get();
    return student?.name || 'Student';
  } catch {
    return 'Student';
  }
}

/**
 * Look up class name from classes
 */
export async function getClassName(db: any, classId?: string): Promise<string> {
  if (!classId) return 'Class';
  try {
    const cls = await db
      .select({ name: classes.name })
      .from(classes)
      .where(eq(classes.id, classId))
      .get();
    return cls?.name || 'Class';
  } catch {
    return 'Class';
  }
}

/**
 * Look up assignment title from assignments
 */
export async function getAssignmentTitle(db: any, assignmentId?: string): Promise<string> {
  if (!assignmentId) return 'Assignment';
  try {
    const asg = await db
      .select({ title: assignments.title })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .get();
    return asg?.title || 'Assignment';
  } catch {
    return 'Assignment';
  }
}

/**
 * Persist an immutable audit log entry for the school
 */
export async function recordAuditLog(
  db: any,
  params: RecordAuditParams
): Promise<void> {
  try {
    let userName = params.user;
    if (!userName && params.userId) {
      userName = await getAdminName(db, params.userId);
    }

    const now = params.createdAt || new Date().toISOString();

    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      schoolId: params.schoolId,
      user: userName || 'User',
      action: params.action,
      category: params.category || 'General',
      createdAt: now,
    });
  } catch (error) {
    console.error('[audit] Failed to record audit log:', error);
  }
}
