import re
import os

ADMIN_FILE = 'src/routes/admin/index.ts'
with open(ADMIN_FILE, 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace("import { eq } from 'drizzle-orm';", "import { encryptData, decryptData, hashIdentifier } from '../../lib/encryption';\nimport { eq } from 'drizzle-orm';")

# 2. getEncryptionSecret
secret_fn = """const getEncryptionSecret = (env: Bindings) => {
  if (env.ENCRYPTION_SECRET) return env.ENCRYPTION_SECRET;
  if (env.ENVIRONMENT === 'production') {
    throw new Error('FATAL SECURITY ERROR: ENCRYPTION_SECRET environment variable is required in production.');
  }
  return 'somobloom_super_secret_encryption_key_123';
};

// Apply JWT middleware"""
content = content.replace("// Apply JWT middleware", secret_fn)

# 3. POST /teachers
content = content.replace("""  const db = getDb(c.env.DB);

  // Check if email already exists
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const teacherProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        email,
        passwordHash: hashedPassword,
      }),""", """  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  // Check if email already exists
  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const teacherProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        emailHash,
        encryptedEmail,
        passwordHash: hashedPassword,
      }),""")

# 4. POST /students
content = content.replace("""  const db = getDb(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, email, passwordHash: hashedPassword }),""", """  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const studentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, emailHash, encryptedEmail, passwordHash: hashedPassword }),""")

# 5. POST /parents
content = content.replace("""  const db = getDb(c.env.DB);
  const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const parentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, email, passwordHash: hashedPassword }),""", """  const db = getDb(c.env.DB);
  const encryptionSecret = getEncryptionSecret(c.env);
  const emailHash = await hashIdentifier(email, encryptionSecret);
  const encryptedEmail = await encryptData(email, encryptionSecret);

  const existingUser = await db.select().from(users).where(eq(users.emailHash, emailHash)).get();
  if (existingUser) {
    return c.json({ error: 'User with this email already exists' }, 400);
  }

  const userId = crypto.randomUUID();
  const parentProfileId = crypto.randomUUID();
  const hashedPassword = await hashPassword(password);

  try {
    await db.batch([
      db.insert(users).values({ id: userId, emailHash, encryptedEmail, passwordHash: hashedPassword }),""")

# 6. GET /users
content = content.replace("email: users.email", "encryptedEmail: users.encryptedEmail")

decryption_logic = """
    const encryptionSecret = getEncryptionSecret(c.env);

    const decryptUserEmail = async (u: any) => {
      const email = await decryptData(u.encryptedEmail, encryptionSecret);
      const { encryptedEmail, ...rest } = u;
      return { ...rest, email };
    };

    const combinedUsers = await Promise.all([
      ...admins.map(a => ({ ...a, role: 'admin', status: 'active' })),
      ...teachers.map(t => ({ ...t, role: 'teacher', status: 'active' })),
      ...students.map(s => ({ ...s, role: 'student', status: 'active' })),
      ...parents.map(p => ({ ...p, role: 'parent', status: 'active' }))
    ].map(decryptUserEmail));

    return c.json({ users: combinedUsers });"""

content = re.sub(r'const combinedUsers = \[.*?\n    \];\n\n    return c\.json\(\{ users: combinedUsers \}\);', decryption_logic, content, flags=re.DOTALL)

# 7. PUT /users/:id
content = content.replace("""    const updates: Promise<any>[] = [];

    if (email) {
      updates.push(db.update(users).set({ email }).where(eq(users.id, userId)));
    }""", """    const updates: Promise<any>[] = [];
    const encryptionSecret = getEncryptionSecret(c.env);

    if (email) {
      const emailHash = await hashIdentifier(email, encryptionSecret);
      const encryptedEmail = await encryptData(email, encryptionSecret);
      updates.push(db.update(users).set({ emailHash, encryptedEmail }).where(eq(users.id, userId)));
    }""")

with open(ADMIN_FILE, 'w') as f:
    f.write(content)
print("Updated admin index.ts")

# TEACHER INDEX
TEACHER_FILE = 'src/routes/teacher/index.ts'
with open(TEACHER_FILE, 'r') as f:
    content = f.read()

content = content.replace("import { eq, and, inArray } from 'drizzle-orm';", "import { decryptData } from '../../lib/encryption';\nimport { eq, and, inArray } from 'drizzle-orm';")
content = content.replace("// Apply JWT middleware", secret_fn)

content = content.replace("email: users.email", "encryptedEmail: users.encryptedEmail")

content = content.replace("""      const classStudents = allEnrollments.filter((e: any) => e.classId === cls.id);

      const enrichedStudents = classStudents.map((stu: any) => {""", """      const classStudents = allEnrollments.filter((e: any) => e.classId === cls.id);
      const encryptionSecret = getEncryptionSecret(c.env);

      const enrichedStudents = await Promise.all(classStudents.map(async (stu: any) => {
        const decryptedEmail = await decryptData(stu.encryptedEmail, encryptionSecret);""")

content = content.replace("email: stu.email,", "email: decryptedEmail,")

content = content.replace("""        };
      });

      return {""", """        };
      }));

      return {""")

content = content.replace("teacherClasses.map((cls: any) => {", "await Promise.all(teacherClasses.map(async (cls: any) => {")
content = content.replace("""        students: enrichedStudents
      };
    });""", """        students: enrichedStudents
      };
    }));""")

with open(TEACHER_FILE, 'w') as f:
    f.write(content)
print("Updated teacher index.ts")

