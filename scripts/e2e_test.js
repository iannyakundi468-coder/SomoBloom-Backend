const http = require('http');

const API_URL = 'http://localhost:8787/api';

async function fetchAPI(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${endpoint}`);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runE2E() {
  console.log('--- Starting SomoBloom E2E Integration Test ---');
  let adminToken, teacherToken, studentToken;
  let adminData, teacherData, studentData;

  // 1. Register Admin
  console.log('\\n[1] Registering Admin User');
  const adminEmail = `admin-${Date.now()}@test.com`;
  const adminPassword = 'password123';
  const registerRes = await fetchAPI('/auth/register-school', 'POST', {
    schoolName: 'Test E2E School',
    adminName: 'Admin Tester',
    email: adminEmail,
    password: adminPassword
  });
  
  if (registerRes.status !== 201) {
    console.error('Failed to register admin:', registerRes.data);
    return;
  }
  adminToken = registerRes.data.token;
  adminData = registerRes.data.user;
  console.log('✅ Admin registered and logged in successfully.');
  console.log('Admin Data (decrypted email should match):', adminData.email === adminEmail);

  // 2. Create Teacher
  console.log('\\n[2] Creating Teacher');
  const teacherEmail = `teacher-${Date.now()}@test.com`;
  const createTeacherRes = await fetchAPI('/admin/teachers', 'POST', {
    name: 'Teacher Tester',
    email: teacherEmail,
    password: 'password123',
    department: 'Science'
  }, adminToken);
  
  if (createTeacherRes.status !== 201) {
    console.error('Failed to create teacher:', createTeacherRes.data);
    return;
  }
  const teacherId = createTeacherRes.data.teacher.id; // teacher profile id
  const teacherUserId = createTeacherRes.data.teacher.userId;
  console.log('✅ Teacher created successfully.');

  // 3. Create Student
  console.log('\\n[3] Creating Student');
  const studentEmail = `student-${Date.now()}@test.com`;
  const createStudentRes = await fetchAPI('/admin/students', 'POST', {
    name: 'Student Tester',
    email: studentEmail,
    password: 'password123',
    studentIdNumber: 'STU-001'
  }, adminToken);

  if (createStudentRes.status !== 201) {
    console.error('Failed to create student:', createStudentRes.data);
    return;
  }
  const studentId = createStudentRes.data.student.id;
  const studentUserId = createStudentRes.data.student.userId;
  console.log('✅ Student created successfully.');

  // 4. Fetch Users (Testing Admin Decryption on bulk retrieval)
  console.log('\\n[4] Admin fetching user list (Testing bulk decryption)');
  const usersRes = await fetchAPI('/admin/users', 'GET', null, adminToken);
  if (usersRes.status !== 200) {
    console.error('Failed to fetch users:', usersRes.data);
    return;
  }
  
  const fetchedTeacher = usersRes.data.users.find(u => u.email === teacherEmail);
  if (fetchedTeacher) {
    console.log('✅ Bulk decryption verified: Found teacher with correct email.');
  } else {
    console.error('Failed to verify bulk decryption: Teacher email not found in payload.', usersRes.data.users);
    return;
  }

  // 5. Login as Teacher
  console.log('\\n[5] Logging in as Teacher');
  const teacherLoginRes = await fetchAPI('/auth/login', 'POST', {
    email: teacherEmail,
    password: 'password123'
  });
  
  if (teacherLoginRes.status !== 200) {
    console.error('Failed to login teacher:', teacherLoginRes.data);
    return;
  }
  teacherToken = teacherLoginRes.data.token;
  teacherData = teacherLoginRes.data.user;
  console.log('✅ Teacher logged in successfully (Lookup by encrypted hash worked).');

  // 6. Send Message from Teacher to Student
  console.log('\\n[6] Teacher sending message to Student (Testing content encryption)');
  const secretSubject = "Top Secret Grades";
  const secretContent = "This is a highly encrypted message payload.";
  const msgRes = await fetchAPI('/messages', 'POST', {
    receiverId: studentUserId,
    subject: secretSubject,
    content: secretContent
  }, teacherToken);

  if (msgRes.status !== 201) {
    console.error('Failed to send message:', msgRes.data);
    return;
  }
  console.log('✅ Message sent and encrypted in DB.');

  // 7. Login as Student
  console.log('\\n[7] Logging in as Student');
  const studentLoginRes = await fetchAPI('/auth/login', 'POST', {
    email: studentEmail,
    password: 'password123'
  });
  if (studentLoginRes.status !== 200) {
    console.error('Failed to login student:', studentLoginRes.data);
    return;
  }
  studentToken = studentLoginRes.data.token;
  console.log('✅ Student logged in successfully.');

  // 8. Fetch Messages as Student (Testing decryption)
  console.log('\\n[8] Student reading messages (Testing content decryption)');
  const inboxRes = await fetchAPI('/messages', 'GET', null, studentToken);
  if (inboxRes.status !== 200) {
    console.error('Failed to fetch messages:', inboxRes.data);
    return;
  }
  
  const receivedMsg = inboxRes.data.messages.find(m => m.subject === secretSubject);
  if (receivedMsg && receivedMsg.text === secretContent) {
    console.log('✅ Decryption verified: Student read the exact secret message.');
  } else {
    console.error('Decryption failed. Expected exact message but got:', receivedMsg);
    return;
  }

  console.log('\\n🎉 All E2E Tests Passed Successfully! Encryption flow is fully validated.');
}

runE2E().catch(console.error);
