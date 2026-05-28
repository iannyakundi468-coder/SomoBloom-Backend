const API_URL = 'https://somobloombackend.solianwolves.com/api';

async function seed() {
  try {
    console.log('🌱 Starting production database seed...');

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
    const { token: adminToken } = await loginRes.json();
    if (!adminToken) throw new Error("Failed to get admin token");
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
      console.log('✅ Teacher created');
    } else {
      console.log('Teacher might already exist');
    }

    // 3. Create Students
    console.log('Creating students...');
    const studentsData = [
      { name: 'Sarah Smith', email: 'student1@somobloom.com', password: 'demo', studentIdNumber: 'STU-001' },
      { name: 'John Doe', email: 'student2@somobloom.com', password: 'demo', studentIdNumber: 'STU-002' },
      { name: 'Emily Chen', email: 'student3@somobloom.com', password: 'demo', studentIdNumber: 'STU-003' }
    ];
    const studentIds = [];
    
    for (const student of studentsData) {
      const res = await fetch(`${API_URL}/admin/students`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(student)
      });
      if (res.ok) {
        const data = await res.json();
        studentIds.push(data.student.id);
        console.log(`✅ Student created: ${student.name}`);
      } else {
        console.log(`Student ${student.name} might already exist`);
      }
    }

    // 4. Create Parents
    console.log('Creating parents...');
    const parentsData = [
      { name: 'David Smith', email: 'parent1@somobloom.com', password: 'demo', phoneNumber: '+254712345671' },
      { name: 'Jane Doe', email: 'parent2@somobloom.com', password: 'demo', phoneNumber: '+254712345672' },
      { name: 'Michael Chen', email: 'parent3@somobloom.com', password: 'demo', phoneNumber: '+254712345673' }
    ];
    const parentIds = [];

    for (const parent of parentsData) {
      const res = await fetch(`${API_URL}/admin/parents`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(parent)
      });
      if (res.ok) {
        const data = await res.json();
        parentIds.push(data.parent.id);
        console.log(`✅ Parent created: ${parent.name}`);
      } else {
        console.log(`Parent ${parent.name} might already exist`);
      }
    }

    // 5. Link entities and enroll in classes
    if (teacherId && studentIds.length === 3 && parentIds.length === 3) {
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
      
      if (classRes.ok) {
        const classData = await classRes.json();
        const classId = classData.class.id;
        
        // Enroll Students
        console.log('Enrolling students in class...');
        for (const studentId of studentIds) {
          await fetch(`${API_URL}/admin/classes/${classId}/enrollments`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ studentProfileId: studentId })
          });
        }
      }

      // Link Parents to Students
      console.log('Linking parents to students...');
      for (let i = 0; i < 3; i++) {
        await fetch(`${API_URL}/admin/parents/${parentIds[i]}/students/${studentIds[i]}`, {
          method: 'POST',
          headers: authHeaders
        });
      }
      
      console.log('✅ Database seeded successfully!');
    } else {
      console.log('⚠️ Some entities already existed or failed creation, skipped linking.');
    }

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
