// Hostinger-compatible Express server for Becastly API
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint (required by Hostinger)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.get('/api', (req, res) => {
  res.json({ message: 'Becastly API is running' });
});

// Auth routes
app.use('/auth', require('./dist/modules/auth/auth.routes'));

// Contacts routes
app.use('/contacts', require('./dist/modules/contacts/contacts.routes'));

// Campaigns routes
app.use('/campaigns', require('./dist/modules/campaigns/campaigns.routes'));

// Integrations routes
app.use('/integrations', require('./dist/modules/integrations/integrations.routes'));

// Public API routes
app.use('/api/v1', require('./dist/modules/api/api.routes'));

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
