const sqlite3 = require('sqlite3');
const path = require('path');

// Search recursively in state directory for sqlite file
const fs = require('fs');

function findSqliteFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findSqliteFiles(fullPath));
    } else if (file.endsWith('.sqlite') || file === 'db.sqlite') {
      results.push(fullPath);
    }
  });
  return results;
}

try {
  const d1Dir = path.join(__dirname, '.wrangler/state/v3/d1');
  if (!fs.existsSync(d1Dir)) {
    console.log("No local wrangler state directory found.");
    process.exit(0);
  }

  const files = findSqliteFiles(d1Dir);
  if (files.length === 0) {
    console.log("No sqlite database files found in state.");
    process.exit(0);
  }

  console.log("Found database files:", files);
  const db = new sqlite3.Database(files[0]);

  db.all("SELECT u.email, tp.name FROM teacher_profiles tp JOIN users u ON tp.user_id = u.id", [], (err, rows) => {
    if (err) {
      console.error("Error running query:", err);
    } else {
      console.log("\n🔑 ACTIVE TEACHER LOGINS IN LOCAL DATABASE:");
      if (rows.length === 0) {
        console.log("   (No teachers registered in the local database yet)");
      } else {
        rows.forEach(r => {
          console.log(`   - Name: ${r.name} | Email: ${r.email}`);
        });
      }
    }
    
    db.all("SELECT email FROM users", [], (err, allUsers) => {
      if (!err && allUsers.length > 0) {
        console.log("\n👤 ALL REGISTERED EMAILS:");
        allUsers.forEach(u => console.log(`   - ${u.email}`));
      }
      db.close();
    });
  });

} catch (e) {
  console.error("Failed to read database:", e);
}
