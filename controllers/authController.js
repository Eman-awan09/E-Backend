const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const connectDB = require('../lib/connectDB');
const User      = require('../models/User');

const JWT_SECRET  = process.env.JWT_SECRET  || 'emailtools-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ─── helpers ─────────────────────────────────────────────────────────────────
const signToken = (userId, email) =>
  jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

const verifyToken = (token) => {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
};

// ─── Register (first-time setup) ─────────────────────────────────────────────
// POST /api/auth/register
// Body: { email, password, setupKey }
// setupKey must match SETUP_KEY env var — prevents anyone from self-registering
const register = async (req, res) => {
  try {
    await connectDB();
    const { email, password, setupKey } = req.body;

    // Validate setup key
    const validKey = process.env.SETUP_KEY || 'setup-emailtools-2024';
    if (setupKey !== validKey) {
      return res.status(403).json({ error: 'Invalid setup key. Contact the admin.' });
    }

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user   = await User.create({ email: email.toLowerCase(), password: hashed });
    const token  = signToken(user._id, user.email);

    return res.status(201).json({
      success: true,
      token,
      user: { email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error('[register]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
const login = async (req, res) => {
  try {
    await connectDB();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user._id, user.email);

    return res.json({
      success: true,
      token,
      user: { email: user.email, createdAt: user.createdAt },
    });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ─── Verify token ─────────────────────────────────────────────────────────────
// GET /api/auth/verify
// Header: Authorization: Bearer <token>
const verify = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ valid: false, error: 'No token provided.' });

    const decoded = verifyToken(token);
    if (!decoded)  return res.status(401).json({ valid: false, error: 'Token expired or invalid.' });

    await connectDB();
    const user = await User.findById(decoded.userId).select('-password');
    if (!user)     return res.status(401).json({ valid: false, error: 'User not found.' });

    return res.json({ valid: true, user: { email: user.email, createdAt: user.createdAt } });
  } catch (err) {
    return res.status(500).json({ valid: false, error: err.message });
  }
};

// ─── Change password ──────────────────────────────────────────────────────────
// POST /api/auth/change-password
// Header: Authorization: Bearer <token>
// Body: { currentPassword, newPassword }
const changePassword = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated.' });

    const decoded = verifyToken(token);
    if (!decoded)  return res.status(401).json({ error: 'Token expired.' });

    await connectDB();
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user  = await User.findById(decoded.userId);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, verify, changePassword };
