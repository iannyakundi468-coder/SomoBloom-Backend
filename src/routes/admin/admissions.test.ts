import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../../db/db";
import * as schema from "../../db/schema";
import app from "../../index";
import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";

import migration0000 from "../../../drizzle/0000_jazzy_electro.sql?raw";
import migration0001 from "../../../drizzle/0001_supreme_vampiro.sql?raw";
import migration0002 from "../../../drizzle/0002_little_ravenous.sql?raw";
import migration0003 from "../../../drizzle/0003_nice_morlocks.sql?raw";

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

describe("Admin Admissions Pipeline Integration Tests", () => {
  let adminToken: string;
  const schoolId = "school-adm-123";
  const adminUserId = "admin-user-123";

  beforeEach(async () => {
    const d1 = env.DB;

    await d1.exec(`
      DROP TABLE IF EXISTS delegated_responsibilities;
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

    await applyMigration(d1, migration0000);
    await applyMigration(d1, migration0001);
    await applyMigration(d1, migration0002);
    await applyMigration(d1, migration0003);

    const db = getDb(env.DB);

    // Seed school and admin
    await db.insert(schema.schools).values({
      id: schoolId,
      name: "SomoBloom Academy",
      domainSlug: "somobloom-academy",
    });

    await db.insert(schema.users).values({
      id: adminUserId,
      emailHash: "admin_hash_123",
      encryptedEmail: "enc_admin_email",
      passwordHash: "pass_hash",
    });

    await db.insert(schema.adminProfiles).values({
      id: "admin-profile-123",
      userId: adminUserId,
      schoolId,
      name: "School Administrator",
    });

    const payload = {
      sub: adminUserId,
      schoolId,
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    adminToken = await sign(payload, "somobloom_super_secret_dev_key_123");
  });

  it("should fetch all enrollment submissions for the admin's school", async () => {
    const db = getDb(env.DB);
    await db.insert(schema.studentEnrollmentSubmissions).values({
      schoolId,
      admissionNumber: "ADM-2026-001",
      firstName: "David",
      lastName: "Kipchoge",
      gradeApplyingFor: "Grade 4",
      guardianName: "Sarah Kipchoge",
      phoneNumber: "+254712345678",
      email: "david.parent@example.com",
      status: "pending"
    });

    const res = await app.request("/api/admin/admissions", {
      method: "GET",
      headers: { "Authorization": `Bearer ${adminToken}` }
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.enrollments).toHaveLength(1);
    expect(body.enrollments[0].firstName).toBe("David");
    expect(body.enrollments[0].status).toBe("pending");
  });

  it("should approve application and auto-create Student & Parent profiles", async () => {
    const db = getDb(env.DB);
    const [sub] = await db.insert(schema.studentEnrollmentSubmissions).values({
      schoolId,
      admissionNumber: "ADM-2026-002",
      firstName: "Grace",
      lastName: "Wanjiku",
      gradeApplyingFor: "Grade 5",
      guardianName: "James Wanjiku",
      phoneNumber: "+254798765432",
      email: "grace.parent@example.com",
      status: "pending"
    }).returning();

    const res = await app.request(`/api/admin/admissions/${sub.id}/approve`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` }
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.student).toBeDefined();
    expect(body.student.name).toBe("Grace Wanjiku");
    expect(body.parentCreated).toBe(true);

    // Verify DB auto-creation of student profile
    const students = await db.select().from(schema.studentProfiles).where(eq(schema.studentProfiles.schoolId, schoolId)).all();
    expect(students).toHaveLength(1);
    expect(students[0].name).toBe("Grace Wanjiku");

    // Verify DB auto-creation of parent profile & relationship
    const parents = await db.select().from(schema.parentProfiles).where(eq(schema.parentProfiles.schoolId, schoolId)).all();
    expect(parents).toHaveLength(1);
    expect(parents[0].name).toBe("James Wanjiku");

    const relations = await db.select().from(schema.parentStudentRelations).all();
    expect(relations).toHaveLength(1);
    expect(relations[0].studentProfileId).toBe(students[0].id);
    expect(relations[0].parentProfileId).toBe(parents[0].id);
  });

  it("should reject enrollment application successfully", async () => {
    const db = getDb(env.DB);
    const [sub] = await db.insert(schema.studentEnrollmentSubmissions).values({
      schoolId,
      admissionNumber: "ADM-2026-003",
      firstName: "Brian",
      lastName: "Ochieng",
      status: "pending"
    }).returning();

    const res = await app.request(`/api/admin/admissions/${sub.id}/reject`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${adminToken}` }
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.message).toContain("rejected successfully");

    const updated = await db.select().from(schema.studentEnrollmentSubmissions).where(eq(schema.studentEnrollmentSubmissions.id, sub.id)).get();
    expect(updated?.status).toBe("rejected");
  });
});
