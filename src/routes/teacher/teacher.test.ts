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

    // Drop existing tables
    await d1.exec(`
      DROP TABLE IF EXISTS parent_student_relations;
      DROP TABLE IF EXISTS parent_profiles;
      DROP TABLE IF EXISTS student_profiles;
      DROP TABLE IF EXISTS teacher_remarks;
      DROP TABLE IF EXISTS teacher_profiles;
      DROP TABLE IF EXISTS admin_profiles;
      DROP TABLE IF EXISTS enrollments;
      DROP TABLE IF EXISTS classes;
      DROP TABLE IF EXISTS assignments;
      DROP TABLE IF EXISTS grades;
      DROP TABLE IF EXISTS announcements;
      DROP TABLE IF EXISTS student_enrollment_submissions;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS attendance;
      DROP TABLE IF EXISTS portfolio_evidence;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS activity_logs;
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS school_settings;
      DROP TABLE IF EXISTS fee_structures;
      DROP TABLE IF EXISTS timetables;
      DROP TABLE IF EXISTS schools;
      DROP TABLE IF EXISTS users;
    `);

    // Run migrations
    await applyMigration(d1, migration0000);
    await applyMigration(d1, migration0001);
    await applyMigration(d1, migration0002);
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
});
