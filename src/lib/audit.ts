import { eq } from 'drizzle-orm';
import { auditLogs, adminProfiles } from '../db/schema';

export type AuditCategory =
  | 'Users'
  | 'Classes'
  | 'Academics'
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
 * Look up the administrator's display name from adminProfiles if available
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
      user: userName || 'Administrator',
      action: params.action,
      category: params.category || 'General',
      createdAt: now,
    });
  } catch (error) {
    console.error('[audit] Failed to record audit log:', error);
  }
}
