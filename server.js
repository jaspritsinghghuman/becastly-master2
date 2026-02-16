// Hostinger Entry Point - Express-compatible server
const path = require('path');

// Check if built files exist
const fs = require('fs');
const distPath = path.join(__dirname, 'dist', 'app.js');

if (!fs.existsSync(distPath)) {
  console.error('❌ Error: Built files not found!');
  console.error('Please run: npm run build');
  console.error('Or upload the dist/ folder');
  process.exit(1);
}

// Load the compiled app
require(distPath);
