import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../index";
import { clearRateLimits } from "../../lib/rateLimit";
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

describe("Phone-Based Primary Authentication Tests", () => {
  beforeEach(async () => {
    clearRateLimits();
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
  });

  it("should register a school using a Kenyan phone number as primary contact", async () => {
    const res = await app.request("/api/auth/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: "Nairobi Academy",
        adminName: "Mwalimu James",
        phoneNumber: "0712345678",
        password: "SecurePassword123!"
      })
    }, env);

    expect(res.status).toBe(201);
    const data = await res.json() as any;
    expect(data.token).toBeDefined();
    expect(data.user.phoneNumber).toBe("+254712345678");
    expect(data.user.name).toBe("Mwalimu James");
  });

  it("should allow login using local Kenyan format (0712345678)", async () => {
    // 1. Register with Kenyan phone
    await app.request("/api/auth/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: "Mombasa High",
        adminName: "Principal Ali",
        phoneNumber: "0722123456",
        password: "SecretPassword123!"
      })
    }, env);

    // 2. Login using local 0722123456
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "0722123456",
        password: "SecretPassword123!"
      })
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.token).toBeDefined();
    expect(data.user.phoneNumber).toBe("+254722123456");
    expect(data.user.role).toBe("admin");
  });

  it("should allow login using international format (+254722123456) when registered with local 0722...", async () => {
    // 1. Register with local 0722123456
    await app.request("/api/auth/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: "Kisumu Academy",
        adminName: "Director Achieng",
        phoneNumber: "0722123456",
        password: "SecretPassword123!"
      })
    }, env);

    // 2. Login using E.164 +254722123456
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "+254722123456",
        password: "SecretPassword123!"
      })
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.token).toBeDefined();
    expect(data.user.phoneNumber).toBe("+254722123456");
  });

  it("should allow login using national 254 format without plus", async () => {
    await app.request("/api/auth/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: "Nakuru Academy",
        adminName: "Wanjiku Admin",
        phoneNumber: "0799888777",
        password: "SecretPassword123!"
      })
    }, env);

    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: "254799888777",
        password: "SecretPassword123!"
      })
    }, env);

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.token).toBeDefined();
  });

  it("should provision a parent with phone number and let parent log in with their phone", async () => {
    // 1. Register school & admin
    const regRes = await app.request("/api/auth/register-school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schoolName: "Eldoret High",
        adminName: "Kipchoge Admin",
        email: "admin@eldoret.ac.ke",
        phoneNumber: "0700111222",
        password: "AdminPassword123!"
      })
    }, env);

    const { token: adminToken } = await regRes.json() as any;

    // 2. Admin creates parent with phone number
    const parentRes = await app.request("/api/admin/parents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        name: "Mama Otieno",
        phoneNumber: "0711223344",
        password: "ParentPassword123!"
      })
    }, env);

    expect(parentRes.status).toBe(201);

    // 3. Parent logs in using phone number
    const loginRes = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "0711223344",
        password: "ParentPassword123!"
      })
    }, env);

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json() as any;
    expect(loginData.user.role).toBe("parent");
    expect(loginData.user.name).toBe("Mama Otieno");
    expect(loginData.user.phoneNumber).toBe("+254711223344");
  });
});
