const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'drizzle', '0000_jazzy_electro.sql');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/CREATE TABLE `/g, 'CREATE TABLE IF NOT EXISTS `');
content = content.replace(/CREATE UNIQUE INDEX `/g, 'CREATE UNIQUE INDEX IF NOT EXISTS `');

fs.writeFileSync(filePath, content);
console.log('Migration file updated to use IF NOT EXISTS');
