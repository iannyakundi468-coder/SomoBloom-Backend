-- =========================================================================
-- SomoBloom Unified Test & Staging Seed Dataset
-- Generated: 2026-10-17T04:18:33.509Z
-- School: SomoBloom Academy (somobloom-academy)
-- Default credentials for all users: email / demo12345Password!
-- =========================================================================

-- 1. School
INSERT OR IGNORE INTO schools (id, name, domain_slug) VALUES ('5fb87778-253c-4a24-ba6e-873fd9103953', 'SomoBloom Academy', 'somobloom-academy');
INSERT OR IGNORE INTO school_settings (school_id, language, xp_level_up, xp_badge) VALUES ('5fb87778-253c-4a24-ba6e-873fd9103953', 'en', 150, 300);

-- 2. Users
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('fd291c9c-1133-41b4-980e-202bdde84d2b', '1db556865c156acc637469a76a0457684b57899715462f2be1b1ee3e0a2ce377', '6Dq3vv6WdPUkeOzc:tpshYMzUA7LFJO71kmcUI9twX8PEcGgAjxc75ZNLpFwtocY=', '67d7a9ff780e74fe304c5b941696e4af:e5d45074b3c92f6565971460220e90d6682aecbc5c76115a67990a4708d4092c');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('bd51ae12-e8a3-44b2-9eb9-0bac0ddb16ef', '85ae5828e83d2f3150776e53b46a149d6d0dadc1097cada68c7afc537dddf4b7', '8ewAA6DtpcmFLHvC:XPpXv9pmmtChuyIGXArGVKUaf3Q8MClKbqKtIzeidi6IVYVu778=', '67d7a9ff780e74fe304c5b941696e4af:e5d45074b3c92f6565971460220e90d6682aecbc5c76115a67990a4708d4092c');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('a7765068-16bf-4a71-b9a7-30d77049d28a', '2b69562a14372fc88fe83c97c3bc02a2f682145aa2f7ec28a6e84882873d536f', '398IradrWPCTRn8q:N5bBM3N8EswKr7BEO8iUPSm+2igS8whYvZN4EziPVL2Gv9RMvRs=', '67d7a9ff780e74fe304c5b941696e4af:e5d45074b3c92f6565971460220e90d6682aecbc5c76115a67990a4708d4092c');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('3462a870-01ad-4f51-9069-a8ca6947b794', '87691831cee81c640464a3a36c304fb713dfed6bd66f42b70f0f003925f5a5c2', 'EmfYs65JUNIE6wRS:ghJZSPJ5sLDJOf9+/ht7Q2eNQae5vOXu5ucr7aNeq1NLgrvEs9k=', '67d7a9ff780e74fe304c5b941696e4af:e5d45074b3c92f6565971460220e90d6682aecbc5c76115a67990a4708d4092c');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('16809244-6578-4bd3-91c5-6c902dc53c84', 'c7dbc520ef42e4a548543553416948d1a77d141b3cb99c67dec07b0eaab0cd2e', 'RAsmzCUPlsxr3rME:2VS0QH3FOa4xXoauZS5J6Ug5i919qBciI+KjNoya9KIO9YF6eQ==', '67d7a9ff780e74fe304c5b941696e4af:e5d45074b3c92f6565971460220e90d6682aecbc5c76115a67990a4708d4092c');

-- 3. Profiles (RBAC)
INSERT OR IGNORE INTO admin_profiles (id, user_id, school_id, name) VALUES ('64f03dc4-cae6-4e20-9145-20401fdd18d8', 'fd291c9c-1133-41b4-980e-202bdde84d2b', '5fb87778-253c-4a24-ba6e-873fd9103953', 'System Administrator');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('1a1c1ceb-3822-4cdf-b243-ae985f8ed459', 'bd51ae12-e8a3-44b2-9eb9-0bac0ddb16ef', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Mrs. Janet Bloom', 'Science & Mathematics');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('7faebe67-f899-4f61-a003-320ab2f4fb14', 'a7765068-16bf-4a71-b9a7-30d77049d28a', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Mr. Kevin Ochieng', 'Languages & Humanities');
INSERT OR IGNORE INTO student_profiles (id, user_id, school_id, name, admission_number, grade_level) VALUES ('dbd5a5f4-70f7-4aac-b2da-fe5c79eaa3c4', '3462a870-01ad-4f51-9069-a8ca6947b794', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Zawadi Baraka', 'SB-2026-001', 'Grade 4');
INSERT OR IGNORE INTO parent_profiles (id, user_id, school_id, name, phone) VALUES ('99a05985-0b23-45d0-8bef-07049d85cc45', '16809244-6578-4bd3-91c5-6c902dc53c84', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Grace Baraka', '+254700123456');

-- 4. Relations & Enrollments
INSERT OR IGNORE INTO parent_student_relations (parent_profile_id, student_profile_id) VALUES ('99a05985-0b23-45d0-8bef-07049d85cc45', 'dbd5a5f4-70f7-4aac-b2da-fe5c79eaa3c4');

-- 5. Classes & Subjects
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('2b9477ad-35e5-484b-8012-2520bc895b16', '5fb87778-253c-4a24-ba6e-873fd9103953', '1a1c1ceb-3822-4cdf-b243-ae985f8ed459', 'Grade 4 East');
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('7b025103-aac3-459b-994f-9868be17e441', '5fb87778-253c-4a24-ba6e-873fd9103953', '7faebe67-f899-4f61-a003-320ab2f4fb14', 'Grade 7 Alpha (JSS)');
INSERT OR IGNORE INTO enrollments (class_id, student_profile_id) VALUES ('2b9477ad-35e5-484b-8012-2520bc895b16', 'dbd5a5f4-70f7-4aac-b2da-fe5c79eaa3c4');

INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('296216d7-17ac-451f-aa47-332858ae334c', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Mathematics', 'MATH-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('b83e63ea-5aa5-4142-ab3c-2a9348ee61f9', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Integrated Science', 'SCI-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('cfd3291e-d384-4258-bc74-a1ce7e04891b', '5fb87778-253c-4a24-ba6e-873fd9103953', 'English Language', 'ENG-CBC');

INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('2b9477ad-35e5-484b-8012-2520bc895b16', '296216d7-17ac-451f-aa47-332858ae334c', '1a1c1ceb-3822-4cdf-b243-ae985f8ed459');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('2b9477ad-35e5-484b-8012-2520bc895b16', 'b83e63ea-5aa5-4142-ab3c-2a9348ee61f9', '1a1c1ceb-3822-4cdf-b243-ae985f8ed459');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('2b9477ad-35e5-484b-8012-2520bc895b16', 'cfd3291e-d384-4258-bc74-a1ce7e04891b', '7faebe67-f899-4f61-a003-320ab2f4fb14');

-- 6. Announcements
INSERT OR IGNORE INTO announcements (id, school_id, title, content, target_audience, author_id) VALUES ('ann-001', '5fb87778-253c-4a24-ba6e-873fd9103953', 'Welcome to SomoBloom Term 3', 'Term 3 academic activities and assessments have commenced smoothly across all CBC grades.', 'all', 'fd291c9c-1133-41b4-980e-202bdde84d2b');

-- 7. Fee Structures
INSERT OR IGNORE INTO fee_structures (id, school_id, class_id, term, academic_year, amount, breakdown_json) VALUES ('fee-001', '5fb87778-253c-4a24-ba6e-873fd9103953', '2b9477ad-35e5-484b-8012-2520bc895b16', 'Term 3', '2026', 25000, '{"tuition":18000,"activity":4000,"materials":3000}');
