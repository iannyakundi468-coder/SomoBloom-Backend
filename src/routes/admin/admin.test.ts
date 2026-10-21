import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../../db/db";
import * as schema from "../../db/schema";
import app from "../../index";
import { sign } from "hono/jwt";
import { encryptData, hashIdentifier } from "../../lib/encryption";
import { hashPassword } from "../../lib/auth";

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

describe("Admin Routes Suite", () => {
  const secret = "somobloom_super_secret_dev_key_123";
  const encSecret = "somobloom_super_secret_encryption_key_123";
  let adminToken: string;

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
      DROP TABLE IF EXISTS class_subjects;
      DROP TABLE IF EXISTS subjects;
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

    // 1. School
    await db.insert(schema.schools).values({
      id: "school-1",
      name: "SomoBloom Academy",
      domainSlug: "somobloom",
    });

    // 2. Admin User
    const emailHash = await hashIdentifier("admin@somobloom.com", encSecret);
    const encEmail = await encryptData("admin@somobloom.com", encSecret);
    const passHash = await hashPassword("admin123");

    await db.insert(schema.users).values({
      id: "admin-user-1",
      emailHash,
      encryptedEmail: encEmail,
      passwordHash: passHash,
    });

    await db.insert(schema.adminProfiles).values({
      id: "admin-profile-1",
      userId: "admin-user-1",
      schoolId: "school-1",
      name: "Admin Boss",
    });

    adminToken = await sign({
      sub: "admin-user-1",
      schoolId: "school-1",
      role: "admin",
      exp: Math.floor(Date.now() / 1000) + 3600
    }, secret);
  });

  it("should ping admin API", async () => {
    const res = await app.request("/api/admin/ping", {
      headers: { Authorization: `Bearer ${adminToken}` }
    }, env);
    expect(res.status).toBe(200);
  });

  it("should fetch admin profile /me", async () => {
    const res = await app.request("/api/admin/me", {
      headers: { Authorization: `Bearer ${adminToken}` }
    }, env);
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.profile.name).toBe("Admin Boss");
  });

  it("should fetch users, classes, activity, audit, config, fee structures, payments, delegations", async () => {
    const endpoints = [
      "/api/admin/users",
      "/api/admin/classes",
      "/api/admin/activity",
      "/api/admin/audit",
      "/api/admin/config",
      "/api/admin/fees/structures",
      "/api/admin/payments",
      "/api/admin/delegations",
      "/api/admin/enrollments",
      "/api/admin/announcements",
      "/api/admin/subjects",
      "/api/admin/timetable"
    ];

    for (const ep of endpoints) {
      const res = await app.request(ep, {
        headers: { Authorization: `Bearer ${adminToken}` }
      }, env);
      expect(res.status, `Endpoint ${ep} returned status ${res.status}`).toBe(200);
    }
  });

  it("should create, update, and delete teacher", async () => {
    // Create teacher
    const createRes = await app.request("/api/admin/teachers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Mr. Test Teacher",
        email: "teacher@somobloom.com",
        password: "Password123!",
        department: "Science"
      })
    }, env);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json() as any;
    expect(createData.teacher.name).toBe("Mr. Test Teacher");

    const teacherProfileId = createData.teacher.id;

    // Update teacher
    const updateRes = await app.request(`/api/admin/users/${teacherProfileId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Mr. Test Teacher Updated",
        department: "Math"
      })
    }, env);
    expect(updateRes.status).toBe(200);

    // Verify in /users
    const usersRes = await app.request("/api/admin/users", {
      headers: { Authorization: `Bearer ${adminToken}` }
    }, env);
    expect(usersRes.status).toBe(200);
    const usersData = await usersRes.json() as any;
    const found = usersData.users.find((u: any) => u.id === teacherProfileId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Mr. Test Teacher Updated");

    // Delete teacher
    const delRes = await app.request(`/api/admin/users/${teacherProfileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` }
    }, env);
    expect(delRes.status).toBe(200);
  });
});
