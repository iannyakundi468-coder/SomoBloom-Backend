import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- GLOBAL IDENTITIES ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  emailHash: text('email_hash').notNull().unique(),
  encryptedEmail: text('encrypted_email').notNull(),
  phoneNumberHash: text('phone_number_hash').unique(),
  encryptedPhoneNumber: text('encrypted_phone_number'),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- TENANTS ---
export const schools = sqliteTable('schools', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  domainSlug: text('domain_slug').unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- PROFILES ---
export const adminProfiles = sqliteTable('admin_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const teacherProfiles = sqliteTable('teacher_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  department: text('department'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentProfiles = sqliteTable('student_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  studentIdNumber: text('student_id_number'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const parentProfiles = sqliteTable('parent_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- RELATIONSHIPS ---
export const parentStudentRelations = sqliteTable('parent_student_relations', {
  parentProfileId: text('parent_profile_id').references(() => parentProfiles.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.parentProfileId, t.studentProfileId] }),
}));

// --- ACADEMICS ---
export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  teacherProfileId: text('teacher_profile_id').references(() => teacherProfiles.id).notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const enrollments = sqliteTable('enrollments', {
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.classId, t.studentProfileId] }),
}));

export const assignments = sqliteTable('assignments', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: text('due_date'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const grades = sqliteTable('grades', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').references(() => assignments.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  score: integer('score'), // integer or real
  feedback: text('feedback'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  authorProfileId: text('author_profile_id'), // polymorphic reference, kept generic
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetAudience: text('target_audience', { enum: ['all', 'teachers', 'students', 'parents'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- ENROLLMENT SUBMISSIONS (Raw Data) ---
export const studentEnrollmentSubmissions = sqliteTable('student_enrollment_submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  timestamp: text('timestamp'),
  admissionNumber: text('admission_number'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  gender: text('gender'),
  gradeApplyingFor: text('grade_applying_for'),
  guardianName: text('guardian_name'),
  relationship: text('relationship'),
  phoneNumber: text('phone_number'),
  email: text('email'),
  emergencyNumber: text('emergency_number'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).default('pending').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- MESSAGES & COMMUNICATIONS ---
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  senderId: text('sender_id').references(() => users.id).notNull(),
  receiverId: text('receiver_id').references(() => users.id).notNull(),
  subject: text('subject'),
  content: text('content').notNull(),
  isRead: integer('is_read', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- ATTENDANCE & ROLL CALLS ---
export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  date: text('date').notNull(), // format YYYY-MM-DD
  status: text('status', { enum: ['present', 'absent', 'tardy'] }).notNull(),
  remarks: text('remarks'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- PORTFOLIO EVIDENCE ---
export const portfolioEvidence = sqliteTable('portfolio_evidence', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(), // 'Assignment', 'Project', 'Quiz', 'Other'
  description: text('description'),
  imageUrl: text('image_url').notNull(),
  tags: text('tags'), // Comma-separated list of tags
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- FINANCIALS (PAYMENTS & FEES) ---
export const payments = sqliteTable('payments', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id),
  parentName: text('parent_name'),
  amount: integer('amount').notNull(),
  method: text('method').notNull(),
  status: text('status', { enum: ['successful', 'failed', 'overdue'] }).notNull(),
  term: text('term'),
  reference: text('reference').unique(),
  date: text('date').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- ACTIVITY LOGS ---
export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  detail: text('detail'),
  color: text('color'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- AUDIT LOGS ---
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  category: text('category').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- SETTINGS / CONFIG ---
export const schoolSettings = sqliteTable('school_settings', {
  schoolId: text('school_id').primaryKey().references(() => schools.id),
  language: text('language').default('en').notNull(),
  xpLevelUp: integer('xp_level_up').default(150).notNull(),
  xpBadge: integer('xp_badge').default(300).notNull(),
  badgesEnabled: integer('badges_enabled', { mode: 'boolean' }).default(true).notNull(),
  leaderboardEnabled: integer('leaderboard_enabled', { mode: 'boolean' }).default(true).notNull(),
  notifyPayment: integer('notify_payment', { mode: 'boolean' }).default(true).notNull(),
  notifyPortfolio: integer('notify_portfolio', { mode: 'boolean' }).default(true).notNull(),
  notifyAnnouncement: integer('notify_announcement', { mode: 'boolean' }).default(true).notNull(),
  dataRetentionYears: integer('data_retention_years').default(5).notNull(),
  allowParentMessaging: integer('allow_parent_messaging', { mode: 'boolean' }).default(true).notNull(),
  allowStudentLeaderboard: integer('allow_student_leaderboard', { mode: 'boolean' }).default(true).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// --- FEE STRUCTURES ---
export const feeStructures = sqliteTable('fee_structures', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  classId: text('class_id').references(() => classes.id).notNull(),
  term: text('term').notNull(),
  totalAmount: integer('total_amount').notNull(),
  breakdown: text('breakdown').notNull(), // JSON string representing breakdown items
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
