const API_URL = 'http://localhost:8787/api';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // 1. Register School & Admin
    console.log('Creating school and admin...');
    const adminRes = await fetch(`${API_URL}/auth/register-school`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schoolName: 'SomoBloom Academy',
        adminName: 'Admin User',
        email: 'admin@somobloom.com',
        password: 'demo'
      })
    });
    const adminData = await adminRes.json();
    if (!adminRes.ok && adminData.error !== 'User with this email already exists') {
      throw new Error(`Admin creation failed: ${adminData.error}`);
    }

    // Login as admin to get token
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@somobloom.com', password: 'demo' })
    });
    const { token: adminToken, user: adminUser } = await loginRes.json();
    console.log('✅ Admin authenticated');

    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };

    // 2. Create Teacher
    console.log('Creating teacher...');
    const teacherRes = await fetch(`${API_URL}/admin/teachers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Mrs. Janet Bloom',
        email: 'teacher@somobloom.com',
        password: 'demo',
        department: 'Science'
      })
    });
    let teacherId = null;
    if (teacherRes.ok) {
      const data = await teacherRes.json();
      teacherId = data.teacher.id;
    } else {
      console.log('Teacher might already exist');
    }

    // 3. Create Student
    console.log('Creating student...');
    const studentRes = await fetch(`${API_URL}/admin/students`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Sarah Smith',
        email: 'student@somobloom.com',
        password: 'demo',
        studentIdNumber: 'STU-001'
      })
    });
    let studentId = null;
    if (studentRes.ok) {
      const data = await studentRes.json();
      studentId = data.student.id;
    } else {
      console.log('Student might already exist');
    }

    // 4. Create Parent
    console.log('Creating parent...');
    const parentRes = await fetch(`${API_URL}/admin/parents`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'David Smith',
        email: 'parent@somobloom.com',
        password: 'demo',
        phoneNumber: '+254712345678'
      })
    });
    let parentId = null;
    if (parentRes.ok) {
      const data = await parentRes.json();
      parentId = data.parent.id;
    } else {
      console.log('Parent might already exist');
    }

    // If we created everything, let's link them up
    if (teacherId && studentId && parentId) {
      // Create Class
      console.log('Creating class...');
      const classRes = await fetch(`${API_URL}/admin/classes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: 'Grade 4 Science',
          teacherProfileId: teacherId
        })
      });
      const classData = await classRes.json();
      const classId = classData.class.id;

      // Enroll Student
      console.log('Enrolling student in class...');
      await fetch(`${API_URL}/admin/classes/${classId}/enrollments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ studentProfileId: studentId })
      });

      // Link Parent to Student
      console.log('Linking parent to student...');
      await fetch(`${API_URL}/admin/parents/${parentId}/students/${studentId}`, {
        method: 'POST',
        headers: authHeaders
      });
      
      console.log('✅ Database seeded successfully!');
    } else {
      console.log('⚠️ Some entities already existed, skipped linking.');
    }

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
