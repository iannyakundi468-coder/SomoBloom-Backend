import re

with open('src/routes/admin/index.ts', 'r') as f:
    content = f.read()

# Fix missing 'and' import
if "import { eq" in content and "import { eq, and" not in content:
    content = content.replace("import { eq }", "import { eq, and }")
if "import { encryptData" in content and "import { eq } from 'drizzle-orm'" in content:
    content = content.replace("import { eq } from 'drizzle-orm';", "import { eq, and } from 'drizzle-orm';")

# 1. GET /classes
content = content.replace("""adminRouter.get('/classes', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const classList = await db.select().from(classes).all();""", """adminRouter.get('/classes', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const classList = await db.select().from(classes).where(eq(classes.schoolId, payload.schoolId)).all();""")

# 2. GET /enrollments
content = content.replace("""adminRouter.get('/enrollments', async (c) => {
  const db = getDb(c.env.DB);
  try {
    const submissions = await db.select().from(studentEnrollmentSubmissions).all();""", """adminRouter.get('/enrollments', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {
    const submissions = await db.select().from(studentEnrollmentSubmissions).where(eq(studentEnrollmentSubmissions.schoolId, payload.schoolId)).all();""")

# 3. GET /users
users_fetch = """adminRouter.get('/users', async (c) => {
  const db = getDb(c.env.DB);
  try {"""
users_replace = """adminRouter.get('/users', async (c) => {
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);
  try {"""
content = content.replace(users_fetch, users_replace)

content = content.replace(""".from(adminProfiles)
    .innerJoin(users, eq(adminProfiles.userId, users.id))
    .all();""", """.from(adminProfiles)
    .innerJoin(users, eq(adminProfiles.userId, users.id))
    .where(eq(adminProfiles.schoolId, payload.schoolId))
    .all();""")

content = content.replace(""".from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .all();""", """.from(teacherProfiles)
    .innerJoin(users, eq(teacherProfiles.userId, users.id))
    .where(eq(teacherProfiles.schoolId, payload.schoolId))
    .all();""")

content = content.replace(""".from(studentProfiles)
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .all();""", """.from(studentProfiles)
    .innerJoin(users, eq(studentProfiles.userId, users.id))
    .where(eq(studentProfiles.schoolId, payload.schoolId))
    .all();""")

content = content.replace(""".from(parentProfiles)
    .innerJoin(users, eq(parentProfiles.userId, users.id))
    .all();""", """.from(parentProfiles)
    .innerJoin(users, eq(parentProfiles.userId, users.id))
    .where(eq(parentProfiles.schoolId, payload.schoolId))
    .all();""")

# 4. PUT /classes/:id
content = content.replace("""adminRouter.put('/classes/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const db = getDb(c.env.DB);""", """adminRouter.put('/classes/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);""")

content = content.replace("""    const updatedClass = await db.update(classes)
      .set(updates)
      .where(eq(classes.id, id))
      .returning()
      .get();""", """    const updatedClass = await db.update(classes)
      .set(updates)
      .where(and(eq(classes.id, id), eq(classes.schoolId, payload.schoolId)))
      .returning()
      .get();""")

# 5. DELETE /classes/:id
content = content.replace("""adminRouter.delete('/classes/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb(c.env.DB);""", """adminRouter.delete('/classes/:id', async (c) => {
  const id = c.req.param('id');
  const payload = c.get('jwtPayload');
  const db = getDb(c.env.DB);""")

content = content.replace("""    await db.delete(classes).where(eq(classes.id, id));""", """    const cls = await db.select().from(classes).where(and(eq(classes.id, id), eq(classes.schoolId, payload.schoolId))).get();
    if (!cls) return c.json({ error: 'Class not found' }, 404);
    await db.delete(classes).where(eq(classes.id, id));""")

with open('src/routes/admin/index.ts', 'w') as f:
    f.write(content)
print("Updated admin index.ts with strict schoolId checks.")
