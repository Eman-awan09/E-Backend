const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  email:     { type: String },
  status:    { type: String, enum: ['sent', 'failed'] },
  timestamp: { type: String },
  error:     { type: String, default: null },
}, { _id: false });

const DailyStatSchema = new mongoose.Schema({
  date:   { type: String },
  sent:   { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
}, { _id: false });

const CampaignSchema = new mongoose.Schema({
  id:               { type: String, required: true, unique: true },
  name:             { type: String },
  subject:          { type: String, required: true },
  body:             { type: String, required: true },
  fromName:         { type: String },
  recipients:       [String],
  totalRecipients:  { type: Number, default: 0 },
  dailyLimit:       { type: Number, default: 100 },
  delayMs:          { type: Number, default: 1500 },
  smtpConfig: {
    host:   String,
    port:   String,
    user:   String,
    pass:   String,
    secure: Boolean,
  },
  status:       { type: String, default: 'pending' },
  createdAt:    { type: String },
  startedAt:    { type: String, default: null },
  completedAt:  { type: String, default: null },
  sent:         { type: Number, default: 0 },
  failed:       { type: Number, default: 0 },
  pending:      { type: Number, default: 0 },
  currentIndex: { type: Number, default: 0 },
  logs:         [LogSchema],
  dailyStats:   [DailyStatSchema],
  pauseReason:  { type: String, default: null },
  errorMessage: { type: String, default: null },
}, { timestamps: false });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
