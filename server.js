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


const express = require('express');
require('dotenv').config();
const cors = require('cors');

const emailRoutes  = require('./routes/emailRoutes');
const urlRoutes    = require('./routes/urlRoutes');
const senderRoutes = require('./routes/senderRoutes');
const connectDB = require('./lib/connectDB');

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api/emails', emailRoutes);
app.use('/api/urls',   urlRoutes);
app.use('/api/sender', senderRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Email Tools API running', time: new Date().toISOString() });
});

// Required for Vercel serverless export
module.exports = app;

// Also start server when run directly (Render / local)
// if (require.main === module) {
//   const PORT = process.env.PORT || 5000;
//   app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
// }
