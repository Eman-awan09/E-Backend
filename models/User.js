// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//   email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
//   password:  { type: String, required: true },  // bcrypt hashed
//   createdAt: { type: String, default: () => new Date().toISOString() },
// });

// module.exports = mongoose.models.User || mongoose.model('User', UserSchema);

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['user', 'admin'], default: 'user' },
  status:     { type: String, enum: ['active', 'blocked'], default: 'active' },
  createdAt:  { type: String, default: () => new Date().toISOString() },
  lastLogin:  { type: String, default: null },
  // Activity summary (updated on each campaign action)
  totalCampaigns: { type: Number, default: 0 },
  totalSent:      { type: Number, default: 0 },
  totalFailed:    { type: Number, default: 0 },
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
