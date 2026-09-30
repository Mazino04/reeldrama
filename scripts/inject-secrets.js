const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'firebase-config.js');

if (!fs.existsSync(configPath)) {
  console.error(`Error: ${configPath} does not exist.`);
  process.exit(1);
}

let content = fs.readFileSync(configPath, 'utf8');

const replacements = {
  '__FIREBASE_API_KEY__': process.env.FIREBASE_API_KEY || '',
  '__FIREBASE_AUTH_DOMAIN__': process.env.FIREBASE_AUTH_DOMAIN || '',
  '__FIREBASE_DATABASE_URL__': process.env.FIREBASE_DATABASE_URL || '',
  '__FIREBASE_PROJECT_ID__': process.env.FIREBASE_PROJECT_ID || '',
  '__FIREBASE_STORAGE_BUCKET__': process.env.FIREBASE_STORAGE_BUCKET || '',
  '__FIREBASE_MESSAGING_SENDER_ID__': process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  '__FIREBASE_APP_ID__': process.env.FIREBASE_APP_ID || ''
};

const missing = [];
for (const [placeholder, val] of Object.entries(replacements)) {
  if (!val) {
    missing.push(placeholder);
  }
  content = content.split(placeholder).join(val);
}

fs.writeFileSync(configPath, content, 'utf8');

if (missing.length > 0) {
  console.error('❌ Error: The following required Firebase secrets were empty or not configured:');
  missing.forEach(m => console.error(`   - ${m}`));
  if (process.env.CI) {
    console.error('\nPlease add these secrets in your GitHub repository:');
    console.error('Settings -> Secrets and variables -> Actions -> New repository secret');
    process.exit(1);
  }
} else {
  console.log('✅ All Firebase configuration secrets successfully injected into firebase-config.js');
}
