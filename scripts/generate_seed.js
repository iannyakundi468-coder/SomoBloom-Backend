const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function getEncryptionKey(secret) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCODER.encode('SomoBloom-Static-Salt-For-Encryption'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(text, secret) {
  const key = await getEncryptionKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ENCODER.encode(text)
  );
  
  const cipherBase64 = arrayBufferToBase64(cipherBuffer);
  const ivBase64 = arrayBufferToBase64(iv.buffer);
  
  return `${ivBase64}:${cipherBase64}`;
}

async function hashIdentifier(text, secret) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    ENCODER.encode(text.toLowerCase().trim())
  );
  
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const saltArray = Array.from(salt);
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = saltArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function main() {
  const SECRET = process.env.ENCRYPTION_SECRET || 'somobloom_super_secret_encryption_key_123';
  const PASSWORD = process.env.SEED_PASSWORD || 'demo12345Password!';
  const SCHOOL_NAME = process.env.SCHOOL_NAME || 'SomoBloom Academy';
  const DOMAIN_SLUG = process.env.DOMAIN_SLUG || 'somobloom-academy';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@somobloom.com';
  const ADMIN_NAME = process.env.ADMIN_NAME || 'System Administrator';

  const hashedPassword = await hashPassword(PASSWORD);

  // Entities - Fully Dynamic UUIDs
  const schoolId = process.env.SCHOOL_ID || crypto.randomUUID();

  // Admin
  const adminUserId = crypto.randomUUID();
  const adminProfileId = crypto.randomUUID();
  const adminHash = await hashIdentifier(ADMIN_EMAIL, SECRET);
  const adminEnc = await encryptData(ADMIN_EMAIL, SECRET);

  // Teacher 1
  const teacher1UserId = crypto.randomUUID();
  const teacher1ProfileId = crypto.randomUUID();
  const teacher1Email = process.env.TEACHER_EMAIL || 'teacher1@somobloom.com';
  const teacher1Hash = await hashIdentifier(teacher1Email, SECRET);
  const teacher1Enc = await encryptData(teacher1Email, SECRET);

  // Teacher 2
  const teacher2UserId = crypto.randomUUID();
  const teacher2ProfileId = crypto.randomUUID();
  const teacher2Email = 'teacher2@somobloom.com';
  const teacher2Hash = await hashIdentifier(teacher2Email, SECRET);
  const teacher2Enc = await encryptData(teacher2Email, SECRET);

  // Student 1
  const student1UserId = crypto.randomUUID();
  const student1ProfileId = crypto.randomUUID();
  const student1Email = process.env.STUDENT_EMAIL || 'student1@somobloom.com';
  const student1Hash = await hashIdentifier(student1Email, SECRET);
  const student1Enc = await encryptData(student1Email, SECRET);

  // Parent 1
  const parent1UserId = crypto.randomUUID();
  const parent1ProfileId = crypto.randomUUID();
  const parent1Email = process.env.PARENT_EMAIL || 'parent1@somobloom.com';
  const parent1Hash = await hashIdentifier(parent1Email, SECRET);
  const parent1Enc = await encryptData(parent1Email, SECRET);

  // Classes & Subjects
  const class1Id = crypto.randomUUID();
  const class2Id = crypto.randomUUID();
  const subjectMath = crypto.randomUUID();
  const subjectScience = crypto.randomUUID();
  const subjectEnglish = crypto.randomUUID();

  const sql = [
    `-- =========================================================================`,
    `-- SomoBloom Unified Test & Staging Seed Dataset`,
    `-- Generated: ${new Date().toISOString()}`,
    `-- School: ${SCHOOL_NAME} (${DOMAIN_SLUG})`,
    `-- Default credentials for all users: email / ${PASSWORD}`,
    `-- =========================================================================`,
    ``,
    `-- 1. School`,
    `INSERT OR IGNORE INTO schools (id, name, domain_slug) VALUES ('${schoolId}', '${SCHOOL_NAME}', '${DOMAIN_SLUG}');`,
    `INSERT OR IGNORE INTO school_settings (school_id, language, xp_level_up, xp_badge) VALUES ('${schoolId}', 'en', 150, 300);`,
    ``,
    `-- 2. Users`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${adminUserId}', '${adminHash}', '${adminEnc}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${teacher1UserId}', '${teacher1Hash}', '${teacher1Enc}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${teacher2UserId}', '${teacher2Hash}', '${teacher2Enc}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${student1UserId}', '${student1Hash}', '${student1Enc}', '${hashedPassword}');`,
    `INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('${parent1UserId}', '${parent1Hash}', '${parent1Enc}', '${hashedPassword}');`,
    ``,
    `-- 3. Profiles (RBAC)`,
    `INSERT OR IGNORE INTO admin_profiles (id, user_id, school_id, name) VALUES ('${adminProfileId}', '${adminUserId}', '${schoolId}', 'System Administrator');`,
    `INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('${teacher1ProfileId}', '${teacher1UserId}', '${schoolId}', 'Mrs. Janet Bloom', 'Science & Mathematics');`,
    `INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('${teacher2ProfileId}', '${teacher2UserId}', '${schoolId}', 'Mr. Kevin Ochieng', 'Languages & Humanities');`,
    `INSERT OR IGNORE INTO student_profiles (id, user_id, school_id, name, admission_number, grade_level) VALUES ('${student1ProfileId}', '${student1UserId}', '${schoolId}', 'Zawadi Baraka', 'SB-2026-001', 'Grade 4');`,
    `INSERT OR IGNORE INTO parent_profiles (id, user_id, school_id, name, phone) VALUES ('${parent1ProfileId}', '${parent1UserId}', '${schoolId}', 'Grace Baraka', '+254700123456');`,
    ``,
    `-- 4. Relations & Enrollments`,
    `INSERT OR IGNORE INTO parent_student_relations (parent_profile_id, student_profile_id) VALUES ('${parent1ProfileId}', '${student1ProfileId}');`,
    ``,
    `-- 5. Classes & Subjects`,
    `INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('${class1Id}', '${schoolId}', '${teacher1ProfileId}', 'Grade 4 East');`,
    `INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('${class2Id}', '${schoolId}', '${teacher2ProfileId}', 'Grade 7 Alpha (JSS)');`,
    `INSERT OR IGNORE INTO enrollments (class_id, student_profile_id) VALUES ('${class1Id}', '${student1ProfileId}');`,
    ``,
    `INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('${subjectMath}', '${schoolId}', 'Mathematics', 'MATH-CBC');`,
    `INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('${subjectScience}', '${schoolId}', 'Integrated Science', 'SCI-CBC');`,
    `INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('${subjectEnglish}', '${schoolId}', 'English Language', 'ENG-CBC');`,
    ``,
    `INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('${class1Id}', '${subjectMath}', '${teacher1ProfileId}');`,
    `INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('${class1Id}', '${subjectScience}', '${teacher1ProfileId}');`,
    `INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('${class1Id}', '${subjectEnglish}', '${teacher2ProfileId}');`,
    ``,
    `-- 6. Announcements`,
    `INSERT OR IGNORE INTO announcements (id, school_id, title, content, target_audience, author_id) VALUES ('ann-001', '${schoolId}', 'Welcome to SomoBloom Term 3', 'Term 3 academic activities and assessments have commenced smoothly across all CBC grades.', 'all', '${adminUserId}');`,
    ``,
    `-- 7. Fee Structures`,
    `INSERT OR IGNORE INTO fee_structures (id, school_id, class_id, term, academic_year, amount, breakdown_json) VALUES ('fee-001', '${schoolId}', '${class1Id}', 'Term 3', '2026', 25000, '{"tuition":18000,"activity":4000,"materials":3000}');`
  ];

  console.log(sql.join('\n'));
}

main().catch(console.error);
