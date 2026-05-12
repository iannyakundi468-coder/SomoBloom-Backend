import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// --- GLOBAL IDENTITIES ---
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  email: text('email').notNull().unique(),
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
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const teacherProfiles = sqliteTable('teacher_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  department: text('department'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const studentProfiles = sqliteTable('student_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  studentIdNumber: text('student_id_number'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const parentProfiles = sqliteTable('parent_profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  schoolId: text('school_id').references(() => schools.id).notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
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
