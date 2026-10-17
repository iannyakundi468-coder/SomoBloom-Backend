import { hashPassword } from '../src/lib/auth';
import { hashIdentifier, encryptData } from '../src/lib/encryption';

declare const process: any;

const DEFAULT_ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'somobloom_super_secret_encryption_key_123';

async function generateSeedSql() {
  const schoolId = 's1000000-0000-0000-0000-000000000001';
  const adminUserId = 'u1000000-0000-0000-0000-000000000001';
  const adminProfileId = 'p1000000-0000-0000-0000-000000000001';
  const teacherUserId = 'u2000000-0000-0000-0000-000000000002';
  const teacherProfileId = 'p2000000-0000-0000-0000-000000000002';
  const classId = 'c1000000-0000-0000-0000-000000000001';

  const adminEmail = 'admin@somobloom.com';
  const teacherEmail = 'teacher1@somobloom.com';
  const defaultPassword = 'demo12345Password!';

  const adminEmailHash = await hashIdentifier(adminEmail, DEFAULT_ENCRYPTION_SECRET);
  const teacherEmailHash = await hashIdentifier(teacherEmail, DEFAULT_ENCRYPTION_SECRET);

  const encAdminEmail = await encryptData(adminEmail, DEFAULT_ENCRYPTION_SECRET);
  const encTeacherEmail = await encryptData(teacherEmail, DEFAULT_ENCRYPTION_SECRET);

  const hashedPassword = await hashPassword(defaultPassword);

  const sqlStatements = [
    `INSERT OR IGNORE INTO schools (id, name, domain_slug) VALUES ('${schoolId}', 'SomoBloom Academy', 'somobloom-academy');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${adminUserId}', '${adminEmailHash}', '${encAdminEmail}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO admin_profiles (id, user_id, school_id, name) VALUES ('${adminProfileId}', '${adminUserId}', '${schoolId}', 'Administrator');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${teacherUserId}', '${teacherEmailHash}', '${encTeacherEmail}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('${teacherProfileId}', '${teacherUserId}', '${schoolId}', 'Mrs. Janet Bloom', 'Science & Mathematics');`,
    `INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('${classId}', '${schoolId}', '${teacherProfileId}', 'Grade 4 East');`,
    `INSERT OR IGNORE INTO school_settings (school_id, language, xp_level_up, xp_badge) VALUES ('${schoolId}', 'en', 150, 300);`
  ];

  console.log('-- =========================================================');
  console.log('-- SomoBloom Dedicated Production Database Seeding Script');
  console.log('-- Default Admin: admin@somobloom.com / demo12345Password!');
  console.log('-- Default Teacher: teacher1@somobloom.com / demo12345Password!');
  console.log('-- =========================================================');
  console.log(sqlStatements.join('\n'));
}

generateSeedSql().catch(console.error);
