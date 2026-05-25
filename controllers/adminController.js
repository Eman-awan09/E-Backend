const connectDB  = require('../lib/connectDB');
const User       = require('../models/User');
const Campaign   = require('../models/Campaign');
const bcrypt     = require('bcryptjs');

// ─── Get all users with stats ─────────────────────────────────────────────────
const getAllUsers = async (req, res) => {
  try {
    await connectDB();
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });

    // Attach campaign counts per user
    const userIds = users.map(u => u._id);
    const campCounts = await Campaign.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', campaigns: { $sum: 1 }, totalSent: { $sum: '$sent' }, totalFailed: { $sum: '$failed' } } },
    ]);
    const countMap = {};
    campCounts.forEach(c => { countMap[c._id.toString()] = c; });

    const enriched = users.map(u => {
      const stats = countMap[u._id.toString()] || { campaigns: 0, totalSent: 0, totalFailed: 0 };
      return {
        id: u._id, email: u.email, role: u.role, status: u.status,
        createdAt: u.createdAt, lastLogin: u.lastLogin,
        campaigns: stats.campaigns,
        totalSent: stats.totalSent,
        totalFailed: stats.totalFailed,
      };
    });

    return res.json({ users: enriched, total: enriched.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Get single user detail + their campaigns ─────────────────────────────────
const getUserDetail = async (req, res) => {
  try {
    await connectDB();
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const campaigns = await Campaign.find({ userId: user._id })
      .select('-logs -recipients -smtpConfig')
      .sort({ createdAt: -1 });

    return res.json({
      user: {
        id: user._id, email: user.email, role: user.role,
        status: user.status, createdAt: user.createdAt, lastLogin: user.lastLogin,
      },
      campaigns: campaigns.map(c => ({
        id: c.id, name: c.name, subject: c.subject, status: c.status,
        totalRecipients: c.totalRecipients, sent: c.sent, failed: c.failed,
        pending: c.pending, createdAt: c.createdAt, completedAt: c.completedAt,
        dailyLimit: c.dailyLimit,
        successRate: c.sent + c.failed > 0 ? Math.round((c.sent / (c.sent + c.failed)) * 100) : 0,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Update user (role, status, email, reset password) ───────────────────────
const updateUser = async (req, res) => {
  try {
    await connectDB();
    const { role, status, email, newPassword } = req.body;

    // Prevent admin from demoting themselves
    if (req.params.userId === req.user._id.toString() && role && role !== 'admin')
      return res.status(400).json({ error: 'You cannot change your own role.' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (role)   user.role   = role;
    if (status) user.status = status;
    if (email)  user.email  = email.toLowerCase().trim();
    if (newPassword) {
      if (newPassword.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();
    return res.json({
      success: true, message: 'User updated.',
      user: { id: user._id, email: user.email, role: user.role, status: user.status },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Block / Unblock user ─────────────────────────────────────────────────────
const toggleBlock = async (req, res) => {
  try {
    await connectDB();
    if (req.params.userId === req.user._id.toString())
      return res.status(400).json({ error: 'You cannot block yourself.' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = user.status === 'blocked' ? 'active' : 'blocked';
    await user.save();
    return res.json({ success: true, status: user.status, message: `User ${user.status}.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Delete user + all their data ────────────────────────────────────────────
const deleteUser = async (req, res) => {
  try {
    await connectDB();
    if (req.params.userId === req.user._id.toString())
      return res.status(400).json({ error: 'You cannot delete yourself.' });

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Delete all their campaigns
    const campResult = await Campaign.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });

    return res.json({
      success: true,
      message: `User ${user.email} and ${campResult.deletedCount} campaign(s) deleted.`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Delete a specific campaign (admin override) ──────────────────────────────
const adminDeleteCampaign = async (req, res) => {
  try {
    await connectDB();
    const r = await Campaign.deleteOne({ id: req.params.campaignId });
    if (!r.deletedCount) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ success: true, message: 'Campaign deleted.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Platform-wide stats ──────────────────────────────────────────────────────
const getPlatformStats = async (req, res) => {
  try {
    await connectDB();
    const [totalUsers, blockedUsers, totalCampaigns, aggResult] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'blocked' }),
      Campaign.countDocuments({}),
      Campaign.aggregate([
        { $group: { _id: null, totalSent: { $sum: '$sent' }, totalFailed: { $sum: '$failed' } } },
      ]),
    ]);

    const agg = aggResult[0] || { totalSent: 0, totalFailed: 0 };

    // Recent signups (last 7 days)
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const recentUsers = await User.countDocuments({ createdAt: { $gte: since } });

    // Active campaigns
    const activeCampaigns = await Campaign.countDocuments({ status: { $in: ['running', 'pending'] } });

    return res.json({
      totalUsers, blockedUsers, recentUsers,
      totalCampaigns, activeCampaigns,
      totalSent: agg.totalSent, totalFailed: agg.totalFailed,
      successRate: agg.totalSent + agg.totalFailed > 0
        ? Math.round((agg.totalSent / (agg.totalSent + agg.totalFailed)) * 100)
        : 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllUsers, getUserDetail, updateUser, toggleBlock, deleteUser, adminDeleteCampaign, getPlatformStats };
