import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../../db/db";
import * as schema from "../../db/schema";
import app from "../../index";
import { sign } from "hono/jwt";

// Import migrations as raw text using Vite's ?raw loader
import migration0000 from "../../../drizzle/0000_jazzy_electro.sql?raw";
import migration0001 from "../../../drizzle/0001_supreme_vampiro.sql?raw";
import migration0002 from "../../../drizzle/0002_little_ravenous.sql?raw";
import migration0003 from "../../../drizzle/0003_nice_morlocks.sql?raw";

// Helper to run Drizzle migrations sequentially
async function applyMigration(d1: D1Database, migrationText: string) {
  const statements = migrationText.split("--> statement-breakpoint");
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) {
      const cleaned = trimmed.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
      await d1.exec(cleaned);
    }
  }
}

describe("Teacher Timetable Integration Test", () => {
  beforeEach(async () => {
    const d1 = env.DB;

    // Drop existing tables in reverse dependency order
    await d1.exec(`
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS attendance;
      DROP TABLE IF EXISTS portfolio_evidence;
      DROP TABLE IF EXISTS grades;
      DROP TABLE IF EXISTS assignments;
      DROP TABLE IF EXISTS enrollments;
      DROP TABLE IF EXISTS class_subjects;
      DROP TABLE IF EXISTS subjects;
      DROP TABLE IF EXISTS fee_structures;
      DROP TABLE IF EXISTS classes;
      DROP TABLE IF EXISTS teacher_remarks;
      DROP TABLE IF EXISTS parent_student_relations;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS delegated_responsibilities;
      DROP TABLE IF EXISTS parent_profiles;
      DROP TABLE IF EXISTS student_profiles;
      DROP TABLE IF EXISTS teacher_profiles;
      DROP TABLE IF EXISTS admin_profiles;
      DROP TABLE IF EXISTS student_enrollment_submissions;
      DROP TABLE IF EXISTS announcements;
      DROP TABLE IF EXISTS timetables;
      DROP TABLE IF EXISTS school_settings;
      DROP TABLE IF EXISTS schools;
      DROP TABLE IF EXISTS users;
    `);

    // Run migrations
    await applyMigration(d1, migration0000);
    await applyMigration(d1, migration0001);
    await applyMigration(d1, migration0002);
    await applyMigration(d1, migration0003);
  });

  it("should successfully retrieve and filter the timetable for the logged-in teacher", async () => {
    const db = getDb(env.DB);

    // 1. Insert School
    await db.insert(schema.schools).values({
      id: "school-123",
      name: "SomoBloom Academy",
      domainSlug: "somobloom",
    });

    // 2. Insert User (Teacher)
    await db.insert(schema.users).values({
      id: "teacher-user-123",
      emailHash: "teacher_email_hash",
      encryptedEmail: "encrypted_teacher_email",
      passwordHash: "password_hash",
    });

    // 3. Insert Teacher Profile with name "Mr. Robert Frost"
    await db.insert(schema.teacherProfiles).values({
      id: "teacher-profile-123",
      userId: "teacher-user-123",
      schoolId: "school-123",
      name: "Mr. Robert Frost",
      department: "Math",
    });

    // 4. Insert Master Timetable with slots for Mr. Robert Frost and Mrs. Janet Bloom
    const timetableData = {
      schedule: [
        {
          day: "Monday",
          slots: [
            { time: "08:00 - 09:00", class: "Grade 4", subject: "Math", teacher: "Mr. Robert Frost" },
            { time: "09:00 - 10:00", class: "Grade 4", subject: "Science", teacher: "Mrs. Janet Bloom" }
          ]
        },
        {
          day: "Tuesday",
          slots: [
            { time: "10:00 - 11:00", class: "Grade 4", subject: "Math", teacher: "Mr. Robert Frost" }
          ]
        }
      ]
    };

    await db.insert(schema.timetables).values({
      id: "timetable-123",
      schoolId: "school-123",
      term: "Term 2",
      data: JSON.stringify(timetableData),
      createdAt: new Date().toISOString()
    });

    // 5. Sign a dev JWT token for the teacher
    const payload = {
      sub: "teacher-user-123",
      schoolId: "school-123",
      role: "teacher",
      exp: Math.floor(Date.now() / 1000) + 60 * 60
    };
    const secret = "somobloom_super_secret_dev_key_123";
    const token = await sign(payload, secret);

    // 6. Make a mock request to the Hono application
    const res = await app.request("/api/teacher/timetable", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }, env);

    // 7. Verify response status and filtered contents
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.timetable).toBeDefined();
    
    // The timetable should only contain slots for Mr. Robert Frost
    const schedule = body.timetable.schedule;
    expect(schedule).toHaveLength(2); // Monday and Tuesday both have slots for Mr. Robert Frost
    
    // Check Monday slot
    expect(schedule[0].day).toBe("Monday");
    expect(schedule[0].slots).toHaveLength(1);
    expect(schedule[0].slots[0].teacher).toBe("Mr. Robert Frost");
    expect(schedule[0].slots[0].subject).toBe("Math");

    // Check Tuesday slot
    expect(schedule[1].day).toBe("Tuesday");
    expect(schedule[1].slots).toHaveLength(1);
    expect(schedule[1].slots[0].teacher).toBe("Mr. Robert Frost");
  });

  it("should record audit logs when a teacher marks and modifies student attendance", async () => {
    const db = getDb(env.DB);

    // Setup basic school, teacher, class, student
    await db.insert(schema.schools).values({ id: "school-123", name: "SomoBloom Academy", domainSlug: "somobloom" });
    await db.insert(schema.users).values({ id: "teacher-user-123", emailHash: "thash", encryptedEmail: "tenc", passwordHash: "tpw" });
    await db.insert(schema.teacherProfiles).values({ id: "teacher-profile-123", userId: "teacher-user-123", schoolId: "school-123", name: "Mr. Robert Frost" });
    await db.insert(schema.classes).values({ id: "class-123", schoolId: "school-123", name: "Grade 4 East", teacherProfileId: "teacher-profile-123" });
    
    await db.insert(schema.users).values({ id: "student-user-123", emailHash: "shash", encryptedEmail: "senc", passwordHash: "spw" });
    await db.insert(schema.studentProfiles).values({ id: "student-profile-123", userId: "student-user-123", schoolId: "school-123", name: "Jane Doe" });
    await db.insert(schema.enrollments).values({ classId: "class-123", studentProfileId: "student-profile-123" });

    const payload = { sub: "teacher-user-123", schoolId: "school-123", role: "teacher", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await sign(payload, "somobloom_super_secret_dev_key_123");

    // 1. Mark attendance as present
    const res1 = await app.request("/api/teacher/classes/class-123/attendance", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ studentProfileId: "student-profile-123", isPresent: true })
    }, env);

    expect(res1.status).toBe(201);

    // 2. Modify attendance to absent
    const res2 = await app.request("/api/teacher/classes/class-123/attendance", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ studentProfileId: "student-profile-123", isPresent: false })
    }, env);

    expect(res2.status).toBe(200);

    // Verify audit logs were created
    const logs = await db.select().from(schema.auditLogs).all();
    expect(logs.length).toBe(2);

    const markLog = logs.find(l => l.action.includes("Marked attendance"));
    expect(markLog).toBeDefined();
    expect(markLog?.category).toBe("Attendance");
    expect(markLog?.user).toBe("Mr. Robert Frost (Teacher)");
    expect(markLog?.action).toContain("Jane Doe");
    expect(markLog?.action).toContain("Present");

    const modifyLog = logs.find(l => l.action.includes("Modified attendance"));
    expect(modifyLog).toBeDefined();
    expect(modifyLog?.category).toBe("Attendance");
    expect(modifyLog?.user).toBe("Mr. Robert Frost (Teacher)");
    expect(modifyLog?.action).toContain("Jane Doe");
    expect(modifyLog?.action).toContain("from Present to Absent");
  });

  it("should record audit logs when a teacher enters or alters CBC assessments and grades assignments", async () => {
    const db = getDb(env.DB);

    // Setup basic school, teacher, class, student
    await db.insert(schema.schools).values({ id: "school-123", name: "SomoBloom Academy", domainSlug: "somobloom" });
    await db.insert(schema.users).values({ id: "teacher-user-123", emailHash: "thash", encryptedEmail: "tenc", passwordHash: "tpw" });
    await db.insert(schema.teacherProfiles).values({ id: "teacher-profile-123", userId: "teacher-user-123", schoolId: "school-123", name: "Mr. Robert Frost" });
    await db.insert(schema.classes).values({ id: "class-123", schoolId: "school-123", name: "Grade 4 East", teacherProfileId: "teacher-profile-123" });
    
    await db.insert(schema.users).values({ id: "student-user-123", emailHash: "shash", encryptedEmail: "senc", passwordHash: "spw" });
    await db.insert(schema.studentProfiles).values({ id: "student-profile-123", userId: "student-user-123", schoolId: "school-123", name: "Jane Doe" });
    await db.insert(schema.enrollments).values({ classId: "class-123", studentProfileId: "student-profile-123" });

    const payload = { sub: "teacher-user-123", schoolId: "school-123", role: "teacher", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await sign(payload, "somobloom_super_secret_dev_key_123");

    // 1. Enter CBC Assessment (Level ME)
    const resAssess1 = await app.request("/api/teacher/classes/class-123/assessments", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        studentProfileId: "student-profile-123",
        type: "Strand",
        name: "Multiplication",
        level: "ME"
      })
    }, env);
    expect(resAssess1.status).toBe(200);

    // 2. Alter CBC Assessment (Level EE)
    const resAssess2 = await app.request("/api/teacher/classes/class-123/assessments", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        studentProfileId: "student-profile-123",
        type: "Strand",
        name: "Multiplication",
        level: "EE"
      })
    }, env);
    expect(resAssess2.status).toBe(200);

    // 3. Create an assignment and grade it
    await db.insert(schema.assignments).values({
      id: "assignment-123",
      classId: "class-123",
      title: "Science Volcano Project",
      description: "Build a clay volcano"
    });

    const resGrade = await app.request("/api/teacher/assignments/assignment-123/grades", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        studentProfileId: "student-profile-123",
        score: 95,
        feedback: "Outstanding presentation!"
      })
    }, env);
    expect(resGrade.status).toBe(201);

    // Verify all audit logs recorded
    const logs = await db.select().from(schema.auditLogs).all();
    const gradingLogs = logs.filter(l => l.category === "Grading");
    expect(gradingLogs.length).toBe(3);

    // Recorded assessment
    const assessLog = gradingLogs.find(l => l.action.includes("Recorded CBC assessment"));
    expect(assessLog).toBeDefined();
    expect(assessLog?.user).toBe("Mr. Robert Frost (Teacher)");
    expect(assessLog?.action).toContain("Multiplication");
    expect(assessLog?.action).toContain("Level ME");

    // Altered assessment
    const alterLog = gradingLogs.find(l => l.action.includes("Altered CBC assessment"));
    expect(alterLog).toBeDefined();
    expect(alterLog?.user).toBe("Mr. Robert Frost (Teacher)");
    expect(alterLog?.action).toContain("from Assessment Level: ME to Level EE");

    // Assignment Grade
    const gradeLog = gradingLogs.find(l => l.action.includes("Recorded grade for student"));
    expect(gradeLog).toBeDefined();
    expect(gradeLog?.user).toBe("Mr. Robert Frost (Teacher)");
    expect(gradeLog?.action).toContain("Jane Doe");
    expect(gradeLog?.action).toContain("Science Volcano Project");
    expect(gradeLog?.action).toContain("Score 95");
  });
});

