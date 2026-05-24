// const express = require('express');
// const cors = require('cors');

// const emailRoutes = require('./routes/emailRoutes');
// const urlRoutes = require('./routes/urlRoutes');
// const senderRoutes = require('./routes/senderRoutes');

// const app = express();

// app.use(cors());
// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// app.use('/api/emails', emailRoutes);
// app.use('/api/urls', urlRoutes);
// app.use('/api/sender', senderRoutes);

// app.get('/api/health', (req, res) => {
//   res.json({ status: 'OK', message: 'Email Tools API is running' });
// });

// // const PORT = process.env.PORT || 5000;
// // app.listen(PORT, () => {
// //   console.log(`Server running on http://localhost:${PORT}`);
// // });


// module.exports=app;


// const express = require('express');
// require('dotenv').config();
// const cors = require('cors');

// const emailRoutes  = require('./routes/emailRoutes');
// const urlRoutes    = require('./routes/urlRoutes');
// const senderRoutes = require('./routes/senderRoutes');
// const connectDB = require('./lib/connectDB');

// const app = express();

// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
// }));

// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// app.use('/api/emails', emailRoutes);
// app.use('/api/urls',   urlRoutes);
// app.use('/api/sender', senderRoutes);

// app.get('/api/health', (req, res) => {
//   res.json({ status: 'OK', message: 'Email Tools API running', time: new Date().toISOString() });
// });

// // Required for Vercel serverless export
// module.exports = app;

// Also start server when run directly (Render / local)
// if (require.main === module) {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// }

// const express = require('express');
// const cors    = require('cors');

// const app = express();

// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type'],
// }));
// app.options('*', cors());

// app.use(express.json({ limit: '10mb' }));
// app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// // ── Routes ────────────────────────────────────────────────────────────────
// app.use('/api/emails', require('./routes/emailRoutes'));
// app.use('/api/urls',   require('./routes/urlRoutes'));
// app.use('/api/sender', require('./routes/senderRoutes'));

// // ── Health check ─────────────────────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     mongodb: process.env.MONGODB_URI ? 'configured' : 'MISSING - set MONGODB_URI in Vercel env vars',
//     time: new Date().toISOString(),
//   });
// });

// // Root
// app.get('/', (req, res) => {
//   res.json({ message: 'Email Tools API', version: '3.0', endpoints: ['/api/health', '/api/emails', '/api/urls', '/api/sender'] });
// });

// // ── Global error handler ─────────────────────────────────────────────────
// app.use((err, req, res, next) => {
//   console.error('[Server Error]', err.message);
//   res.status(500).json({ error: err.message || 'Internal server error' });
// });

// // Export for Vercel serverless
// module.exports = app;

// // Listen when run directly (local / Render)
// if (require.main === module) {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// }

const express = require('express');
const cors    = require('cors');

const app = express();

app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/auth',   require('./routes/authRoutes'));
app.use('/api/emails', require('./routes/emailRoutes'));
app.use('/api/urls',   require('./routes/urlRoutes'));
app.use('/api/sender', require('./routes/senderRoutes'));

app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  mongodb: process.env.MONGODB_URI ? 'configured' : 'MISSING',
  jwt:     process.env.JWT_SECRET  ? 'configured' : 'using default (set JWT_SECRET)',
  time:    new Date().toISOString(),
}));

app.get('/', (req, res) => res.json({ message: 'Email Tools API v3', endpoints: ['/api/auth','/api/emails','/api/urls','/api/sender','/api/health'] }));

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
}
