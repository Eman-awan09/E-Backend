const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:  { type: String, required: true },  // bcrypt hashed
  createdAt: { type: String, default: () => new Date().toISOString() },
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
