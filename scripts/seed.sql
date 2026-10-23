-- =========================================================================
-- SomoBloom Unified Test & Staging Seed Dataset
-- Generated: 2026-10-23T17:34:08.852Z
-- School: SomoBloom Academy (somobloom-academy)
-- Default credentials for all users: email / demo12345Password!
-- =========================================================================

-- 1. School
INSERT OR IGNORE INTO schools (id, name, domain_slug) VALUES ('4fb902f5-c468-4392-a50a-f614037d8666', 'SomoBloom Academy', 'somobloom-academy');
INSERT OR IGNORE INTO school_settings (school_id, language, xp_level_up, xp_badge) VALUES ('4fb902f5-c468-4392-a50a-f614037d8666', 'en', 150, 300);

-- 2. Users
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('e494cfcf-172e-4d57-864b-779c251fa85d', '1db556865c156acc637469a76a0457684b57899715462f2be1b1ee3e0a2ce377', 'P5PlF3xga8dCRN63:Bm0ltLBax4QbA7yeOMm5KXr/s6FnvQikClEpBJXfeWlyYF8=', '020d7a9cc9babb2bb88fbec57c044bc0:9192ae76b3af3c94355ba143eb5cc744fc79205fdd9efb20816de78db013c684');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('d334d19f-dc36-401e-b697-a4a2cb9ad8b8', '85ae5828e83d2f3150776e53b46a149d6d0dadc1097cada68c7afc537dddf4b7', 'fUObgiimeQSoKhwt:DCb+Mf8RJ+bqMfbuC62momgJs/GlmTcX/BJxjFGVuMLCIHzSF2I=', '020d7a9cc9babb2bb88fbec57c044bc0:9192ae76b3af3c94355ba143eb5cc744fc79205fdd9efb20816de78db013c684');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('109ddc39-08a4-471b-81fe-79603e4e974a', '2b69562a14372fc88fe83c97c3bc02a2f682145aa2f7ec28a6e84882873d536f', 'lpibbdf9xzsUrsOu:IGP6GKZNizqqCpeuoYqpPr98MPbkg7U8aG/XtBZDCH2hBFzZrzA=', '020d7a9cc9babb2bb88fbec57c044bc0:9192ae76b3af3c94355ba143eb5cc744fc79205fdd9efb20816de78db013c684');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('165e7231-f620-4404-9d75-3b65fd64c937', '87691831cee81c640464a3a36c304fb713dfed6bd66f42b70f0f003925f5a5c2', 'YBsP7pqRdoidV10d:XNU4gLIXTql+dx/6NdRScsZLC4iT2+v0RCOjm2GlEjKm0Cg92nc=', '020d7a9cc9babb2bb88fbec57c044bc0:9192ae76b3af3c94355ba143eb5cc744fc79205fdd9efb20816de78db013c684');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('50e228ec-3b2e-49c4-9a3f-7e0edaeb7c07', 'c7dbc520ef42e4a548543553416948d1a77d141b3cb99c67dec07b0eaab0cd2e', 'pI0UBTziPxN3fGm5:ALC0oOOgtP8rJOI4/Joi5Zwf9WJE5j8aRgPh+hX5zHrvR7InSQ==', '020d7a9cc9babb2bb88fbec57c044bc0:9192ae76b3af3c94355ba143eb5cc744fc79205fdd9efb20816de78db013c684');

-- 3. Profiles (RBAC)
INSERT OR IGNORE INTO admin_profiles (id, user_id, school_id, name) VALUES ('e9c5be89-0a90-4f6b-851d-f25444579cf4', 'e494cfcf-172e-4d57-864b-779c251fa85d', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('a466db9d-9dad-448d-867c-a6a6a28ca765', 'd334d19f-dc36-401e-b697-a4a2cb9ad8b8', '4fb902f5-c468-4392-a50a-f614037d8666', 'Mrs. Janet Bloom', 'Science & Mathematics');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('5c87c00b-eecf-4c35-bec9-ef7de687876d', '109ddc39-08a4-471b-81fe-79603e4e974a', '4fb902f5-c468-4392-a50a-f614037d8666', 'Mr. Kevin Ochieng', 'Languages & Humanities');
INSERT OR IGNORE INTO student_profiles (id, user_id, school_id, name, admission_number, grade_level) VALUES ('1954dbaa-ac38-41a3-b9a7-dae9e2d5b18b', '165e7231-f620-4404-9d75-3b65fd64c937', '4fb902f5-c468-4392-a50a-f614037d8666', 'Zawadi Baraka', 'SB-2026-001', 'Grade 4');
INSERT OR IGNORE INTO parent_profiles (id, user_id, school_id, name, phone) VALUES ('855184be-911e-4b10-be32-1f98e0936396', '50e228ec-3b2e-49c4-9a3f-7e0edaeb7c07', '4fb902f5-c468-4392-a50a-f614037d8666', 'Grace Baraka', '+254700123456');

-- 4. Relations & Enrollments
INSERT OR IGNORE INTO parent_student_relations (parent_profile_id, student_profile_id) VALUES ('855184be-911e-4b10-be32-1f98e0936396', '1954dbaa-ac38-41a3-b9a7-dae9e2d5b18b');

-- 5. Classes & Subjects
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('488206eb-5f64-428a-9799-65cb0190a728', '4fb902f5-c468-4392-a50a-f614037d8666', 'a466db9d-9dad-448d-867c-a6a6a28ca765', 'Grade 4 East');
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('bc78da49-f281-4024-8986-ccaf78127582', '4fb902f5-c468-4392-a50a-f614037d8666', '5c87c00b-eecf-4c35-bec9-ef7de687876d', 'Grade 7 Alpha (JSS)');
INSERT OR IGNORE INTO enrollments (class_id, student_profile_id) VALUES ('488206eb-5f64-428a-9799-65cb0190a728', '1954dbaa-ac38-41a3-b9a7-dae9e2d5b18b');

INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('133dc72f-dcab-45ba-bb03-2c57a66c0dae', '4fb902f5-c468-4392-a50a-f614037d8666', 'Mathematics', 'MATH-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('5b6f76fd-4c26-4907-9302-005f06628eeb', '4fb902f5-c468-4392-a50a-f614037d8666', 'Integrated Science', 'SCI-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('cf82b343-f18c-4004-808a-74036db69adf', '4fb902f5-c468-4392-a50a-f614037d8666', 'English Language', 'ENG-CBC');

INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('488206eb-5f64-428a-9799-65cb0190a728', '133dc72f-dcab-45ba-bb03-2c57a66c0dae', 'a466db9d-9dad-448d-867c-a6a6a28ca765');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('488206eb-5f64-428a-9799-65cb0190a728', '5b6f76fd-4c26-4907-9302-005f06628eeb', 'a466db9d-9dad-448d-867c-a6a6a28ca765');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('488206eb-5f64-428a-9799-65cb0190a728', 'cf82b343-f18c-4004-808a-74036db69adf', '5c87c00b-eecf-4c35-bec9-ef7de687876d');

-- 6. Announcements
INSERT OR IGNORE INTO announcements (id, school_id, title, content, target_audience, author_id) VALUES ('ann-001', '4fb902f5-c468-4392-a50a-f614037d8666', 'Welcome to SomoBloom Term 3', 'Term 3 academic activities and assessments have commenced smoothly across all CBC grades.', 'all', 'e494cfcf-172e-4d57-864b-779c251fa85d');

-- 7. Fee Structures
INSERT OR IGNORE INTO fee_structures (id, school_id, class_id, term, academic_year, amount, breakdown_json) VALUES ('fee-001', '4fb902f5-c468-4392-a50a-f614037d8666', '488206eb-5f64-428a-9799-65cb0190a728', 'Term 3', '2026', 25000, '{"tuition":18000,"activity":4000,"materials":3000}');

-- 8. Audit Logs
INSERT OR IGNORE INTO audit_logs (id, school_id, user, action, category, created_at) VALUES ('audit-001', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator', 'Initial school environment registered and initialized', 'Security', '2026-10-16T17:34:08.852Z');
INSERT OR IGNORE INTO audit_logs (id, school_id, user, action, category, created_at) VALUES ('audit-002', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator', 'Configured default school academic settings and CBC curriculum', 'Settings', '2026-10-18T17:34:08.852Z');
INSERT OR IGNORE INTO audit_logs (id, school_id, user, action, category, created_at) VALUES ('audit-003', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator', 'Provisioned teacher accounts and assigned classes', 'Users', '2026-10-20T17:34:08.852Z');
INSERT OR IGNORE INTO audit_logs (id, school_id, user, action, category, created_at) VALUES ('audit-004', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator', 'Configured Term 3 fee structures and student enrollments', 'Finance', '2026-10-21T17:34:08.852Z');
INSERT OR IGNORE INTO audit_logs (id, school_id, user, action, category, created_at) VALUES ('audit-005', '4fb902f5-c468-4392-a50a-f614037d8666', 'System Administrator', 'Published Term 3 opening announcement to all portals', 'Announcements', '2026-10-22T17:34:08.852Z');
