import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "./db";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

// Import migrations as raw text using Vite's ?raw loader
import migration0000 from "../../drizzle/0000_jazzy_electro.sql?raw";
import migration0001 from "../../drizzle/0001_supreme_vampiro.sql?raw";
import migration0002 from "../../drizzle/0002_little_ravenous.sql?raw";

// Helper to run Drizzle migrations sequentially
async function applyMigration(d1: D1Database, migrationText: string) {
  const statements = migrationText.split("--> statement-breakpoint");
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) {
      // Replace all newlines and tabs with single spaces
      const cleaned = trimmed.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");
      console.log("SQL EXEC:", cleaned);
      await d1.exec(cleaned);
    }
  }
}

describe("Database Isolation Tests", () => {
  beforeEach(async () => {
    const d1 = env.DB;

    // 1. Drop existing tables if they exist to start with a clean slate
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

    // 2. Run Drizzle migrations sequentially on the in-memory simulated D1 database
    await applyMigration(d1, migration0000);
    await applyMigration(d1, migration0001);
    await applyMigration(d1, migration0002);
  });

  it("should insert and retrieve a school inside the isolated D1 emulator", async () => {
    const db = getDb(env.DB);

    // Insert a new school record
    const insertedSchool = await db.insert(schema.schools).values({
      id: "school-123",
      name: "SomoBloom Academy",
      domainSlug: "somobloom-academy",
    }).returning();

    expect(insertedSchool).toHaveLength(1);
    expect(insertedSchool[0].name).toBe("SomoBloom Academy");

    // Query it back
    const queryResults = await db.select().from(schema.schools).where(eq(schema.schools.id, "school-123"));
    expect(queryResults).toHaveLength(1);
    expect(queryResults[0].name).toBe("SomoBloom Academy");
  });

  it("should create a user and assign a profile in isolation", async () => {
    const db = getDb(env.DB);

    // Insert user
    await db.insert(schema.users).values({
      id: "user-123",
      emailHash: "hash_email_123",
      encryptedEmail: "encrypted_email_123",
      passwordHash: "password_hash_123",
    });

    // Insert school
    await db.insert(schema.schools).values({
      id: "school-123",
      name: "SomoBloom Academy",
    });

    // Create student profile
    await db.insert(schema.studentProfiles).values({
      id: "profile-123",
      userId: "user-123",
      schoolId: "school-123",
      name: "Jane Doe",
      studentIdNumber: "SB-001",
    });

    const students = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.id, "profile-123"));
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe("Jane Doe");
  });
});
