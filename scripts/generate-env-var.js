#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
    console.log('Usage: node scripts/generate-env-var.js <path-to-your-service-account-key.json>');
    process.exit(1);
}

try {
    const fullPath = path.resolve(filePath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Parse to ensure valid JSON and remove formatting
    const jsonContent = JSON.parse(content);

    // Re-stringify to get the minified single-line string
    const minified = JSON.stringify(jsonContent);

    console.log('\n✅ Success! Copy the line below into your .env.local file:\n');
    console.log(`GCS_CREDENTIALS_JSON='${minified}'`);
    console.log('\n');
} catch (error) {
    console.error('Error reading or parsing file:', error.message);
    process.exit(1);
}
