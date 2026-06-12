const API_URL = 'https://somobloombackend.solianwolves.com/api';
const delay = ms => new Promise(res => setTimeout(res, ms));

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
    if (!adminRes.ok && !adminData.error?.includes('already exists')) {
      throw new Error(`Admin creation failed: ${adminData.error}`);
    }

    await delay(2500);

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

    await delay(2500);

    // 2. Create Teachers
    console.log('Creating teachers...');
    const teachersData = [
      { name: 'Mrs. Janet Bloom', email: 'teacher1@somobloom.com', password: 'demo', department: 'Science' },
      { name: 'Mr. Robert Frost', email: 'teacher2@somobloom.com', password: 'demo', department: 'Mathematics' }
    ];
    const teacherIds = [];
    for (const teacher of teachersData) {
      const teacherRes = await fetch(`${API_URL}/admin/teachers`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(teacher)
      });
      if (teacherRes.ok) {
        const data = await teacherRes.json();
        teacherIds.push(data.teacher.id);
        console.log(`✅ Teacher created: ${teacher.name}`);
      } else {
        const text = await teacherRes.text();
        console.log(`❌ Failed to create teacher ${teacher.name}: ${text}`);
      }
      await delay(2500);
    }

    // 3. Create Classes using admin token
    console.log('Creating classes...');
    const classesData = [
      { name: 'Grade 4 Science', teacherProfileId: teacherIds[0] },
      { name: 'Grade 4 Mathematics', teacherProfileId: teacherIds[1] }
    ];
    
    const classIds = [];
    for (const cls of classesData) {
      const classRes = await fetch(`${API_URL}/admin/classes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(cls)
      });
      
      if (classRes.ok) {
        const classData = await classRes.json();
        classIds.push(classData.class.id);
      }
    }

    if (classIds.length !== 2) {
      throw new Error("Failed to create classes");
    }

    // 4. Create Students using Teacher tokens
    console.log('Creating students via Teacher API...');
    
    // Login as Teacher 1
    const t1Login = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher1@somobloom.com', password: 'demo' })
    });
    const { token: t1Token } = await t1Login.json();
    const t1Headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t1Token}` };

    // Login as Teacher 2
    const t2Login = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teacher2@somobloom.com', password: 'demo' })
    });
    const { token: t2Token } = await t2Login.json();
    const t2Headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t2Token}` };

    const studentsData = [
      { name: 'Sarah Smith', email: 'student1@somobloom.com', password: 'demo', studentIdNumber: 'STU-001', tHeader: t1Headers, classId: classIds[0] },
      { name: 'John Doe', email: 'student2@somobloom.com', password: 'demo', studentIdNumber: 'STU-002', tHeader: t1Headers, classId: classIds[0] },
      { name: 'Emily Chen', email: 'student3@somobloom.com', password: 'demo', studentIdNumber: 'STU-003', tHeader: t2Headers, classId: classIds[1] },
      { name: 'Michael Johnson', email: 'student4@somobloom.com', password: 'demo', studentIdNumber: 'STU-004', tHeader: t2Headers, classId: classIds[1] }
    ];
    
    const studentIds = [];
    for (const student of studentsData) {
      const { tHeader, classId, ...studentBody } = student;
      const res = await fetch(`${API_URL}/teacher/classes/${classId}/students`, {
        method: 'POST',
        headers: tHeader,
        body: JSON.stringify(studentBody)
      });
      if (res.ok) {
        const data = await res.json();
        studentIds.push(data.student.id);
        console.log(`✅ Student created: ${student.name}`);
      } else {
        const text = await res.text();
        console.log(`❌ Failed to create student ${student.name}: Status ${res.status} - ${text}`);
      }
      await delay(2500);
    }

    // 5. Create Parents using admin token
    console.log('Creating parents...');
    const parentsData = [
      { name: 'David Smith', email: 'parent1@somobloom.com', password: 'demo', phoneNumber: '+254712345671' },
      { name: 'Jane Doe', email: 'parent2@somobloom.com', password: 'demo', phoneNumber: '+254712345672' },
      { name: 'Mary Chen', email: 'parent3@somobloom.com', password: 'demo', phoneNumber: '+254712345673' },
      { name: 'William Johnson', email: 'parent4@somobloom.com', password: 'demo', phoneNumber: '+254712345674' }
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
        const text = await res.text();
        console.log(`❌ Failed to create parent ${parent.name}: Status ${res.status} - ${text}`);
      }
      await delay(2500);
    }

    // 6. Link entities
    if (teacherIds.length === 2 && studentIds.length === 4 && parentIds.length === 4) {
      // Link Parents to Students
      console.log('Linking parents to students...');
      for (let i = 0; i < 4; i++) {
        await fetch(`${API_URL}/admin/parents/${parentIds[i]}/students/${studentIds[i]}`, {
          method: 'POST',
          headers: authHeaders
        });
      }
      
      console.log('✅ Database seeded successfully!');
    } else {
      console.log('⚠️ Some entities failed creation, skipped linking.');
    }

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
