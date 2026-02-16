// Becastly - Hostinger Compatible Entry Point
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
app.use(express.urlencoded({ extended: true }));

// Health check (required by Hostinger)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'becastly-api'
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Becastly API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      '/health',
      '/api',
      '/api/auth/register',
      '/api/auth/login',
      '/api/contacts',
      '/api/campaigns'
    ]
  });
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  res.json({ success: true, message: 'Registration endpoint' });
});

app.post('/api/auth/login', async (req, res) => {
  res.json({ success: true, message: 'Login endpoint' });
});

app.get('/api/auth/me', async (req, res) => {
  res.json({ success: true, user: null });
});

// Contacts Routes
app.get('/api/contacts', (req, res) => {
  res.json({ 
    success: true, 
    contacts: [],
    message: 'Contacts fetched'
  });
});

app.post('/api/contacts', (req, res) => {
  res.json({ success: true, message: 'Contact created' });
});

// Campaigns Routes
app.get('/api/campaigns', (req, res) => {
  res.json({ 
    success: true, 
    campaigns: [],
    message: 'Campaigns fetched'
  });
});

app.post('/api/campaigns', (req, res) => {
  res.json({ success: true, message: 'Campaign created' });
});

// Stats
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalContacts: 0,
      totalCampaigns: 0,
      messagesSent: 0
    }
  });
});

// Frontend placeholder
app.get('/', (req, res) => {
  res.json({
    message: 'Becastly API is running',
    status: 'ok',
    documentation: '/api'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Becastly API is running!');
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
  console.log(`🔧 Port: ${PORT}`);
});

module.exports = app;
