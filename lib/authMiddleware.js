const jwt = require('jsonwebtoken');
const User = require('../models/User');
const connectDB = require('./connectDB');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Attach req.user from JWT — returns 401 if invalid/missing
const requireAuth = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required.' });

    const token   = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);

    await connectDB();
    const user = await User.findById(payload.id).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found.' });
    if (user.status === 'blocked')
      return res.status(403).json({ error: 'Your account has been blocked. Contact admin.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Additional check — admin only
const requireAdmin = async (req, res, next) => {
  await requireAuth(req, res, async () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required.' });
    next();
  });
};

module.exports = { requireAuth, requireAdmin };
