import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';
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
}, (table) => ({
  userIdIdx: index('admin_profiles_user_id_idx').on(table.userId),
  schoolIdIdx: index('admin_profiles_school_id_idx').on(table.schoolId),
}));

export const teacherProfiles = sqliteTable('teacher_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  department: text('department'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index('teacher_profiles_user_id_idx').on(table.userId),
  schoolIdIdx: index('teacher_profiles_school_id_idx').on(table.schoolId),
}));

export const studentProfiles = sqliteTable('student_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  studentIdNumber: text('student_id_number'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index('student_profiles_user_id_idx').on(table.userId),
  schoolIdIdx: index('student_profiles_school_id_idx').on(table.schoolId),
}));

export const parentProfiles = sqliteTable('parent_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  avatarUrl: text('avatar_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  userIdIdx: index('parent_profiles_user_id_idx').on(table.userId),
  schoolIdIdx: index('parent_profiles_school_id_idx').on(table.schoolId),
}));

// --- RELATIONSHIPS ---
export const parentStudentRelations = sqliteTable('parent_student_relations', {
  parentProfileId: text('parent_profile_id').references(() => parentProfiles.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.parentProfileId, t.studentProfileId] }),
  parentIdx: index('parent_student_relations_parent_idx').on(t.parentProfileId),
  studentIdx: index('parent_student_relations_student_idx').on(t.studentProfileId),
}));

// --- ACADEMICS ---
export const classes = sqliteTable('classes', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  teacherProfileId: text('teacher_profile_id').references(() => teacherProfiles.id).notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('classes_school_id_idx').on(table.schoolId),
  teacherProfileIdIdx: index('classes_teacher_profile_id_idx').on(table.teacherProfileId),
}));

export const enrollments = sqliteTable('enrollments', {
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.classId, t.studentProfileId] }),
  classIdx: index('enrollments_class_idx').on(t.classId),
  studentIdx: index('enrollments_student_idx').on(t.studentProfileId),
}));

export const assignments = sqliteTable('assignments', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: text('due_date'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  classIdIdx: index('assignments_class_id_idx').on(table.classId),
}));

export const grades = sqliteTable('grades', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').references(() => assignments.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  score: integer('score'),
  feedback: text('feedback'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  assignmentIdIdx: index('grades_assignment_id_idx').on(table.assignmentId),
  studentProfileIdIdx: index('grades_student_profile_id_idx').on(table.studentProfileId),
}));

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  authorProfileId: text('author_profile_id'),
  title: text('title').notNull(),
  content: text('content').notNull(),
  targetAudience: text('target_audience', { enum: ['all', 'teachers', 'students', 'parents'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('announcements_school_id_idx').on(table.schoolId),
}));

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
}, (table) => ({
  schoolIdIdx: index('student_enrollment_submissions_school_id_idx').on(table.schoolId),
}));

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
}, (table) => ({
  schoolIdIdx: index('messages_school_id_idx').on(table.schoolId),
  senderIdIdx: index('messages_sender_id_idx').on(table.senderId),
  receiverIdIdx: index('messages_receiver_id_idx').on(table.receiverId),
}));

// --- ATTENDANCE & ROLL CALLS ---
export const attendance = sqliteTable('attendance', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  date: text('date').notNull(), // format YYYY-MM-DD
  status: text('status', { enum: ['present', 'absent', 'tardy'] }).notNull(),
  remarks: text('remarks'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  classIdIdx: index('attendance_class_id_idx').on(table.classId),
  studentProfileIdIdx: index('attendance_student_profile_id_idx').on(table.studentProfileId),
  dateIdx: index('attendance_date_idx').on(table.date),
}));

// --- PORTFOLIO EVIDENCE ---
export const portfolioEvidence = sqliteTable('portfolio_evidence', {
  id: text('id').primaryKey(),
  classId: text('class_id').references(() => classes.id).notNull(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  description: text('description'),
  imageUrl: text('image_url').notNull(),
  tags: text('tags'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  classIdIdx: index('portfolio_evidence_class_id_idx').on(table.classId),
  studentProfileIdIdx: index('portfolio_evidence_student_profile_id_idx').on(table.studentProfileId),
}));

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
}, (table) => ({
  schoolIdIdx: index('payments_school_id_idx').on(table.schoolId),
  studentProfileIdIdx: index('payments_student_profile_id_idx').on(table.studentProfileId),
}));

// --- ACTIVITY LOGS ---
export const activityLogs = sqliteTable('activity_logs', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  detail: text('detail'),
  color: text('color'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('activity_logs_school_id_idx').on(table.schoolId),
}));

// --- AUDIT LOGS ---
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  user: text('user').notNull(),
  action: text('action').notNull(),
  category: text('category').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('audit_logs_school_id_idx').on(table.schoolId),
}));

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
  breakdown: text('breakdown').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('fee_structures_school_id_idx').on(table.schoolId),
  classIdIdx: index('fee_structures_class_id_idx').on(table.classId),
}));

// --- TIMETABLES ---
export const timetables = sqliteTable('timetables', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  term: text('term').notNull(),
  data: text('data').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('timetables_school_id_idx').on(table.schoolId),
}));

// --- TEACHER REMARKS ---
export const teacherRemarks = sqliteTable('teacher_remarks', {
  id: text('id').primaryKey(),
  studentProfileId: text('student_profile_id').references(() => studentProfiles.id).notNull(),
  teacherProfileId: text('teacher_profile_id').references(() => teacherProfiles.id).notNull(),
  remark: text('remark').notNull(),
  term: text('term'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  studentProfileIdIdx: index('teacher_remarks_student_profile_id_idx').on(table.studentProfileId),
  teacherProfileIdIdx: index('teacher_remarks_teacher_profile_id_idx').on(table.teacherProfileId),
}));

// --- DELEGATED RESPONSIBILITIES ---
export const delegatedResponsibilities = sqliteTable('delegated_responsibilities', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  teacherProfileId: text('teacher_profile_id').references(() => teacherProfiles.id).notNull(),
  responsibility: text('responsibility', { enum: ['admissions', 'finances', 'timetable', 'announcements'] }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => ({
  schoolIdIdx: index('delegated_responsibilities_school_id_idx').on(table.schoolId),
  teacherProfileIdIdx: index('delegated_responsibilities_teacher_profile_id_idx').on(table.teacherProfileId),
}));
