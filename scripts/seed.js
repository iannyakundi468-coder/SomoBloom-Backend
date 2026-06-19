const API_URL = process.env.API_URL || 'https://somobloombackend.solianwolves.com/api';
const delay = ms => new Promise(res => setTimeout(res, ms));

async function getAuthHeadersFor(email, password) {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const { token } = await loginRes.json();
  if (!token) throw new Error(`Failed to log in as ${email}`);
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

async function seed() {
  try {
    console.log(`🌱 Starting production database seed on URL: ${API_URL}...`);

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
    const t1Headers = await getAuthHeadersFor('teacher1@somobloom.com', 'demo');

    // Login as Teacher 2
    const t2Headers = await getAuthHeadersFor('teacher2@somobloom.com', 'demo');

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
      console.log('✅ Parents linked to students');
      await delay(2500);

      // 7. Seed Fee Structures
      console.log('Creating fee structures...');
      const class1FeeStruct = {
        classId: classIds[0],
        term: 'Term 2 2026',
        totalAmount: 32000,
        breakdown: [
          { name: 'Tuition Fee', cost: 20000 },
          { name: 'Meals & Food Program', cost: 5000 },
          { name: 'Creative Activities & Sports', cost: 3000 },
          { name: 'School Transport Bus', cost: 4000 }
        ]
      };
      const class2FeeStruct = {
        classId: classIds[1],
        term: 'Term 2 2026',
        totalAmount: 38000,
        breakdown: [
          { name: 'Tuition Fee', cost: 25000 },
          { name: 'Meals & Food Program', cost: 6000 },
          { name: 'Creative Activities & Sports', cost: 3500 },
          { name: 'School Transport Bus', cost: 3500 }
        ]
      };
      
      const feeRes1 = await fetch(`${API_URL}/admin/fees/structures`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(class1FeeStruct)
      });
      const feeRes2 = await fetch(`${API_URL}/admin/fees/structures`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(class2FeeStruct)
      });
      if (feeRes1.ok && feeRes2.ok) {
        console.log('✅ Fee structures created');
      } else {
        console.log('❌ Failed to create fee structures', feeRes1.status, feeRes2.status);
      }
      await delay(2500);

      // 8. Seed Announcements
      console.log('Creating announcements...');
      const announcementsData = [
        { title: 'Parent-Teacher Association Meeting', content: 'Our Term 2 PTA meeting will be held this Friday at 2:00 PM in the school main hall. All parents are encouraged to attend.', targetAudience: 'parents' },
        { title: 'Annual Inter-School Sports Day', content: 'SomoBloom Academy Annual Sports Day will take place next month on the 15th. Dress code for learners is their house sports t-shirts.', targetAudience: 'all' },
        { title: 'Mid-Term Progress Report Cards', content: 'Please note that mid-term report cards will be released online via the portals next week.', targetAudience: 'parents' }
      ];
      for (const ann of announcementsData) {
        await fetch(`${API_URL}/admin/announcements`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(ann)
        });
      }
      console.log('✅ Announcements seeded');
      await delay(2500);

      // 9. Seed Assignments & Grades
      console.log('Creating assignments and grades...');
      // Teacher 1 (Janet Bloom) creates assignments for Grade 4 Science (classIds[0])
      const assignment1Res = await fetch(`${API_URL}/teacher/classes/${classIds[0]}/assignments`, {
        method: 'POST',
        headers: t1Headers,
        body: JSON.stringify({ title: 'Photosynthesis Experiment', description: 'Grow a seedling and document leaf changes.', dueDate: '2026-07-10' })
      });
      const { assignment: assignment1 } = await assignment1Res.json();
      await delay(2500);

      const assignment2Res = await fetch(`${API_URL}/teacher/classes/${classIds[0]}/assignments`, {
        method: 'POST',
        headers: t1Headers,
        body: JSON.stringify({ title: 'Plant Cell Structure Model', description: 'Build a plant cell model using clay.', dueDate: '2026-07-20' })
      });
      const { assignment: assignment2 } = await assignment2Res.json();
      await delay(2500);

      // Teacher 2 (Robert Frost) creates assignments for Grade 4 Mathematics (classIds[1])
      const assignment3Res = await fetch(`${API_URL}/teacher/classes/${classIds[1]}/assignments`, {
        method: 'POST',
        headers: t2Headers,
        body: JSON.stringify({ title: 'Multiplication Strands', description: 'CBC multiplication exercises.', dueDate: '2026-07-15' })
      });
      const { assignment: assignment3 } = await assignment3Res.json();
      await delay(2500);

      const assignment4Res = await fetch(`${API_URL}/teacher/classes/${classIds[1]}/assignments`, {
        method: 'POST',
        headers: t2Headers,
        body: JSON.stringify({ title: 'Fractions strands', description: 'Fraction exercises.', dueDate: '2026-07-25' })
      });
      const { assignment: assignment4 } = await assignment4Res.json();
      await delay(2500);

      // Seed Grades
      if (assignment1 && assignment2) {
        // Sarah Smith (studentIds[0])
        await fetch(`${API_URL}/teacher/assignments/${assignment1.id}/grades`, {
          method: 'POST',
          headers: t1Headers,
          body: JSON.stringify({ studentProfileId: studentIds[0], score: 92, feedback: 'Exemplary work and observation journal!' })
        });
        await fetch(`${API_URL}/teacher/assignments/${assignment2.id}/grades`, {
          method: 'POST',
          headers: t1Headers,
          body: JSON.stringify({ studentProfileId: studentIds[0], score: 85, feedback: 'Very neat clay model.' })
        });
        // John Doe (studentIds[1])
        await fetch(`${API_URL}/teacher/assignments/${assignment1.id}/grades`, {
          method: 'POST',
          headers: t1Headers,
          body: JSON.stringify({ studentProfileId: studentIds[1], score: 78, feedback: 'Good effort, follow the scientific method steps.' })
        });
        await fetch(`${API_URL}/teacher/assignments/${assignment2.id}/grades`, {
          method: 'POST',
          headers: t1Headers,
          body: JSON.stringify({ studentProfileId: studentIds[1], score: 80, feedback: 'Nicely labeled parts.' })
        });
      }
      await delay(2500);

      if (assignment3 && assignment4) {
        // Emily Chen (studentIds[2])
        await fetch(`${API_URL}/teacher/assignments/${assignment3.id}/grades`, {
          method: 'POST',
          headers: t2Headers,
          body: JSON.stringify({ studentProfileId: studentIds[2], score: 95, feedback: 'Flawless multiplication accuracy!' })
        });
        await fetch(`${API_URL}/teacher/assignments/${assignment4.id}/grades`, {
          method: 'POST',
          headers: t2Headers,
          body: JSON.stringify({ studentProfileId: studentIds[2], score: 88, feedback: 'Strong understanding of division.' })
        });
        // Michael Johnson (studentIds[3])
        await fetch(`${API_URL}/teacher/assignments/${assignment3.id}/grades`, {
          method: 'POST',
          headers: t2Headers,
          body: JSON.stringify({ studentProfileId: studentIds[3], score: 70, feedback: 'Keep practicing multiplication tables.' })
        });
        await fetch(`${API_URL}/teacher/assignments/${assignment4.id}/grades`, {
          method: 'POST',
          headers: t2Headers,
          body: JSON.stringify({ studentProfileId: studentIds[3], score: 72, feedback: 'Understand the concept of halves.' })
        });
      }
      console.log('✅ Assignments and grades seeded');
      await delay(2500);

      // 10. Seed Portfolio Evidence
      console.log('Creating portfolio evidence...');
      const portfolios = [
        { studentProfileId: studentIds[0], classId: classIds[0], title: 'Photosynthesis Diagram', type: 'Assignment', description: 'Detailed leaf structure drawing.', imageUrl: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&q=80', tags: 'Science,EE', headers: t1Headers },
        { studentProfileId: studentIds[0], classId: classIds[0], title: 'Weather Station Project', type: 'Project', description: 'Build a weather vane.', imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80', tags: 'Science,ME', headers: t1Headers },
        { studentProfileId: studentIds[1], classId: classIds[0], title: 'Leaf Pressing Portfolio', type: 'Project', description: 'Classified 5 types of local leaves.', imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=600&q=80', tags: 'Science,ME', headers: t1Headers },
        { studentProfileId: studentIds[2], classId: classIds[1], title: 'Geometric Shapes Poster', type: 'Project', description: 'Poster identifying 2D and 3D shapes.', imageUrl: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80', tags: 'Math,EE', headers: t2Headers },
        { studentProfileId: studentIds[3], classId: classIds[1], title: 'Math Riddle Presentation', type: 'Assignment', description: 'Created a short presentation for fraction riddles.', imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80', tags: 'Math,ME', headers: t2Headers }
      ];
      for (const item of portfolios) {
        const { headers, ...body } = item;
        await fetch(`${API_URL}/teacher/portfolio`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });
      }
      console.log('✅ Portfolio evidence seeded');
      await delay(2500);

      // 11. Seed Payments (via Parent login)
      console.log('Seeding payments...');
      const parentEmails = [
        'parent1@somobloom.com',
        'parent2@somobloom.com',
        'parent3@somobloom.com',
        'parent4@somobloom.com'
      ];
      const parentStudentPairs = [
        { email: parentEmails[0], studentId: studentIds[0], amount: 20000, method: 'mpesa' },
        { email: parentEmails[0], studentId: studentIds[0], amount: 5000, method: 'card' },
        { email: parentEmails[1], studentId: studentIds[1], amount: 18000, method: 'mpesa' },
        { email: parentEmails[2], studentId: studentIds[2], amount: 30000, method: 'bank' },
        { email: parentEmails[3], studentId: studentIds[3], amount: 15000, method: 'mpesa' }
      ];
      for (const p of parentStudentPairs) {
        const pHeaders = await getAuthHeadersFor(p.email, 'demo');
        await fetch(`${API_URL}/parent/payments`, {
          method: 'POST',
          headers: pHeaders,
          body: JSON.stringify({ studentId: p.studentId, amount: p.amount, method: p.method })
        });
        await delay(1000);
      }
      console.log('✅ Payments seeded');
      await delay(2500);

      // 12. Seed Messages
      console.log('Seeding communication messages...');
      const p1Headers = await getAuthHeadersFor('parent1@somobloom.com', 'demo');
      const p1ProfileRes = await fetch(`${API_URL}/parent/me`, { headers: p1Headers });
      const { profile: p1Profile } = await p1ProfileRes.json();
      
      const t1ProfileRes = await fetch(`${API_URL}/teacher/me`, { headers: t1Headers });
      const { profile: t1Profile } = await t1ProfileRes.json();
      
      if (p1Profile && t1Profile) {
        // Parent 1 sends to Teacher 1
        await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: p1Headers,
          body: JSON.stringify({
            receiverId: t1Profile.userId,
            subject: 'Question on Photosynthesis Experiment',
            content: 'Hello Mrs. Janet, I wanted to clarify if Sarah needs to bring her seedling to school this week?'
          })
        });
        await delay(1000);

        // Teacher 1 sends to Parent 1
        await fetch(`${API_URL}/messages`, {
          method: 'POST',
          headers: t1Headers,
          body: JSON.stringify({
            receiverId: p1Profile.userId,
            subject: 'Re: Question on Photosynthesis Experiment',
            content: 'Hi David, yes, please have her bring it on Friday for the class presentations. She has done a fantastic job!'
          })
        });
        await delay(1000);
      }
      console.log('✅ Messages seeded');

      console.log('✅ Full database seeded successfully!');
    } else {
      console.log('⚠️ Some entities failed creation, skipped linking and advanced seeding.');
    }

  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seed();
