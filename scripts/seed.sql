-- =========================================================================
-- SomoBloom Unified Test & Staging Seed Dataset
-- Generated: 2026-10-17T08:58:06.801Z
-- School: SomoBloom Academy (somobloom-academy)
-- Default credentials for all users: email / demo12345Password!
-- =========================================================================

-- 1. School
INSERT OR IGNORE INTO schools (id, name, domain_slug) VALUES ('1704b825-3683-4fcf-b856-5ea6f10044d1', 'SomoBloom Academy', 'somobloom-academy');
INSERT OR IGNORE INTO school_settings (school_id, language, xp_level_up, xp_badge) VALUES ('1704b825-3683-4fcf-b856-5ea6f10044d1', 'en', 150, 300);

-- 2. Users
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('3bba4e70-70aa-4871-a36a-5ad7e1e5ebed', '1db556865c156acc637469a76a0457684b57899715462f2be1b1ee3e0a2ce377', 'yxPkAX9k3Apqwu6W:Q1kO2EpObfreU5gLgYQ7P1MTSotqbQMTD5eaX2zMcuv2b2o=', '6eea7ef80bbe42c80a8d6a59279c7b02:6a7acef5871d922985d05b545d176d00895a75cdd6dcbdfa2e230b7229a7efd4');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('29fdb829-d6d7-4fd6-b166-8b82e150dec9', '85ae5828e83d2f3150776e53b46a149d6d0dadc1097cada68c7afc537dddf4b7', '6AHO7lEkO8ddIrWu:6NGNAzydTkf6JbthQtao33nXrTEjtSKdKb7M0x51ZTAMjmJGG1M=', '6eea7ef80bbe42c80a8d6a59279c7b02:6a7acef5871d922985d05b545d176d00895a75cdd6dcbdfa2e230b7229a7efd4');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('3d94bbb0-ab7b-4928-aad3-76db099d9e4e', '2b69562a14372fc88fe83c97c3bc02a2f682145aa2f7ec28a6e84882873d536f', 'BNmeFyExd/nN9p1H:uCaH9ZJmYEC/xdx60iB86kN7sPzAm9pePHCwNBVUwOrYzGADTVU=', '6eea7ef80bbe42c80a8d6a59279c7b02:6a7acef5871d922985d05b545d176d00895a75cdd6dcbdfa2e230b7229a7efd4');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('81e071aa-30f2-4c59-95ba-40471a9c2de2', '87691831cee81c640464a3a36c304fb713dfed6bd66f42b70f0f003925f5a5c2', 'L0fwMsNF4zVHBsqX:VspLw0M20MhZ/O4D3KCSHjxJ2nsMaZhu+z8vVvDSpDyDDMToHUU=', '6eea7ef80bbe42c80a8d6a59279c7b02:6a7acef5871d922985d05b545d176d00895a75cdd6dcbdfa2e230b7229a7efd4');
INSERT OR IGNORE INTO users (id, email_hash, encrypted_email, password_hash) VALUES ('c7e7b8ff-d4fd-4dd7-b65c-d9c27ff5d2a9', 'c7dbc520ef42e4a548543553416948d1a77d141b3cb99c67dec07b0eaab0cd2e', '8JR0GSVmmyiqt0mh:vxPQH0IQ18teBHlZ/uQFfxF0sdY2pUCCcLaS+MtEyHrYHWMApg==', '6eea7ef80bbe42c80a8d6a59279c7b02:6a7acef5871d922985d05b545d176d00895a75cdd6dcbdfa2e230b7229a7efd4');

-- 3. Profiles (RBAC)
INSERT OR IGNORE INTO admin_profiles (id, user_id, school_id, name) VALUES ('65b81955-1004-4540-95ce-ef8ad296340e', '3bba4e70-70aa-4871-a36a-5ad7e1e5ebed', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'System Administrator');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('7f343d6a-900b-4468-b032-eeb05206e9ec', '29fdb829-d6d7-4fd6-b166-8b82e150dec9', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Mrs. Janet Bloom', 'Science & Mathematics');
INSERT OR IGNORE INTO teacher_profiles (id, user_id, school_id, name, department) VALUES ('e26b1abd-c1dc-400f-9d70-b73b178ffa1f', '3d94bbb0-ab7b-4928-aad3-76db099d9e4e', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Mr. Kevin Ochieng', 'Languages & Humanities');
INSERT OR IGNORE INTO student_profiles (id, user_id, school_id, name, admission_number, grade_level) VALUES ('621e73a2-1aff-4b9e-9f86-a32bd0b1f1ea', '81e071aa-30f2-4c59-95ba-40471a9c2de2', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Zawadi Baraka', 'SB-2026-001', 'Grade 4');
INSERT OR IGNORE INTO parent_profiles (id, user_id, school_id, name, phone) VALUES ('91b96db8-b35b-4a09-9b65-2e90adec8ea0', 'c7e7b8ff-d4fd-4dd7-b65c-d9c27ff5d2a9', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Grace Baraka', '+254700123456');

-- 4. Relations & Enrollments
INSERT OR IGNORE INTO parent_student_relations (parent_profile_id, student_profile_id) VALUES ('91b96db8-b35b-4a09-9b65-2e90adec8ea0', '621e73a2-1aff-4b9e-9f86-a32bd0b1f1ea');

-- 5. Classes & Subjects
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', '1704b825-3683-4fcf-b856-5ea6f10044d1', '7f343d6a-900b-4468-b032-eeb05206e9ec', 'Grade 4 East');
INSERT OR IGNORE INTO classes (id, school_id, teacher_profile_id, name) VALUES ('338c3aa2-08c6-429b-a1c3-2bad66840e20', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'e26b1abd-c1dc-400f-9d70-b73b178ffa1f', 'Grade 7 Alpha (JSS)');
INSERT OR IGNORE INTO enrollments (class_id, student_profile_id) VALUES ('93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', '621e73a2-1aff-4b9e-9f86-a32bd0b1f1ea');

INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('2b1e7f9c-7377-48e0-9966-7bed3daac751', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Mathematics', 'MATH-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('035b9e79-1de6-46e8-86b3-379f750b4ec6', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Integrated Science', 'SCI-CBC');
INSERT OR IGNORE INTO subjects (id, school_id, name, code) VALUES ('b607bd9d-afcb-4e82-8cc1-5a48bd84911d', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'English Language', 'ENG-CBC');

INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', '2b1e7f9c-7377-48e0-9966-7bed3daac751', '7f343d6a-900b-4468-b032-eeb05206e9ec');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', '035b9e79-1de6-46e8-86b3-379f750b4ec6', '7f343d6a-900b-4468-b032-eeb05206e9ec');
INSERT OR IGNORE INTO class_subjects (class_id, subject_id, teacher_profile_id) VALUES ('93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', 'b607bd9d-afcb-4e82-8cc1-5a48bd84911d', 'e26b1abd-c1dc-400f-9d70-b73b178ffa1f');

-- 6. Announcements
INSERT OR IGNORE INTO announcements (id, school_id, title, content, target_audience, author_id) VALUES ('ann-001', '1704b825-3683-4fcf-b856-5ea6f10044d1', 'Welcome to SomoBloom Term 3', 'Term 3 academic activities and assessments have commenced smoothly across all CBC grades.', 'all', '3bba4e70-70aa-4871-a36a-5ad7e1e5ebed');

-- 7. Fee Structures
INSERT OR IGNORE INTO fee_structures (id, school_id, class_id, term, academic_year, amount, breakdown_json) VALUES ('fee-001', '1704b825-3683-4fcf-b856-5ea6f10044d1', '93d67897-f4b2-49f9-a1c3-11fbdb21a1e4', 'Term 3', '2026', 25000, '{"tuition":18000,"activity":4000,"materials":3000}');
