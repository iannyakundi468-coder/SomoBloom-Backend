import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import app from "../../index";
import { getJwtSecret, getEncryptionSecret } from "../../lib/config";
import { getDb } from "../../db/client";
import * as schema from "../../db/schema";
import migration0000 from "../../../drizzle/0000_jazzy_electro.sql?raw";
import migration0001 from "../../../drizzle/0001_supreme_vampiro.sql?raw";
import migration0002 from "../../../drizzle/0002_little_ravenous.sql?raw";
import migration0003 from "../../../drizzle/0003_add_performance_indexes.sql?raw";

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

describe("Security Hardening & Protection Tests", () => {
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
  });

  describe("Config & Secret Management Security", () => {
    it("should throw fatal error in production environment if JWT_SECRET is missing", () => {
      const prodEnv = { ENVIRONMENT: 'production' };
      expect(() => getJwtSecret(prodEnv)).toThrow("FATAL SECURITY ERROR: JWT_SECRET environment variable is strictly required in production.");
    });

    it("should throw fatal error in production environment if ENCRYPTION_SECRET is missing", () => {
      const prodEnv = { ENVIRONMENT: 'production' };
      expect(() => getEncryptionSecret(prodEnv)).toThrow("FATAL SECURITY ERROR: ENCRYPTION_SECRET environment variable is strictly required in production.");
    });

    it("should return dev fallback secret in non-production environments", () => {
      const devEnv = { ENVIRONMENT: 'development' };
      expect(getJwtSecret(devEnv)).toBe('somobloom_super_secret_dev_key_123');
      expect(getEncryptionSecret(devEnv)).toBe('somobloom_super_secret_encryption_key_123');
    });
  });

  describe("Authentication Endpoint Protection", () => {
    it("should reject school registration with short passwords (< 8 chars)", async () => {
      const res = await app.request("/api/auth/register-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: "Test Academy",
          adminName: "Admin User",
          email: "admin@test.com",
          password: "short"
        })
      }, env);

      expect(res.status).toBe(400);
      const body = await res.json() as any;
      expect(body.error).toBe("Password must be at least 8 characters long");
    });

    it("should NOT auto-seed database on login attempt when users table is empty", async () => {
      const res = await app.request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@somobloom.com",
          password: "demo"
        })
      }, env);

      expect(res.status).toBe(401);
      const body = await res.json() as any;
      expect(body.error).toBe("Invalid credentials");

      // Verify that database remains completely empty (no auto-seeding occurred)
      const db = getDb(env.DB);
      const usersList = await db.select().from(schema.users).all();
      expect(usersList).toHaveLength(0);
    });

    it("should enforce rate limiting after 5 consecutive login attempts", async () => {
      const requestPayload = {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": "203.0.113.19" },
        body: JSON.stringify({ email: "user@example.com", password: "wrongpassword123" })
      };

      // Perform 5 allowed requests
      for (let i = 0; i < 5; i++) {
        const res = await app.request("/api/auth/login", requestPayload, env);
        expect(res.status).toBe(401);
      }

      // 6th request should be rate-limited with HTTP 429
      const blockedRes = await app.request("/api/auth/login", requestPayload, env);
      expect(blockedRes.status).toBe(429);
      const body = await blockedRes.json() as any;
      expect(body.error).toBe("Too many requests. Please try again later.");
    });
  });
});
