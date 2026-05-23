// const nodemailer = require('nodemailer');
// const { v4: uuidv4 } = require('uuid');

// // ─── In-Memory Store (replace with DB in production) ──────────────────────
// const campaigns = {}; // { [campaignId]: Campaign }
// const dailySentLog = {}; // { [YYYY-MM-DD]: count }

// // ─── Helpers ───────────────────────────────────────────────────────────────
// const today = () => new Date().toISOString().slice(0, 10);

// const getTodaySent = () => dailySentLog[today()] || 0;

// const incrementDailySent = (n = 1) => {
//   const d = today();
//   dailySentLog[d] = (dailySentLog[d] || 0) + n;
// };

// const parseEmails = (raw) => {
//   if (!raw || typeof raw !== 'string') return [];
//   const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
//   const found = raw.match(emailRegex) || [];
//   return [...new Set(found.map(e => e.toLowerCase().trim()))];
// };

// const buildTransporter = (smtpConfig) => {
//   return nodemailer.createTransport({
//     host: smtpConfig.host,
//     port: parseInt(smtpConfig.port) || 587,
//     secure: smtpConfig.secure === true || smtpConfig.port == 465,
//     auth: {
//       user: smtpConfig.user,
//       pass: smtpConfig.pass,
//     },
//     tls: { rejectUnauthorized: false },
//   });
// };

// const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// // ─── Create Campaign ────────────────────────────────────────────────────────
// const createCampaign = (req, res) => {
//   try {
//     const {
//       name,
//       subject,
//       body,
//       fromName,
//       emailsRaw,
//       dailyLimit,
//       delayMs,
//       smtpConfig,
//     } = req.body;

//     if (!subject || !body || !emailsRaw || !smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
//       return res.status(400).json({ error: 'Missing required fields: subject, body, emails, smtpConfig (host/user/pass)' });
//     }

//     const recipients = parseEmails(emailsRaw);
//     if (recipients.length === 0) {
//       return res.status(400).json({ error: 'No valid email addresses found.' });
//     }

//     const campaignId = uuidv4();
//     const limit = parseInt(dailyLimit) || 100;
//     const delay = parseInt(delayMs) || 1000;

//     const campaign = {
//       id: campaignId,
//       name: name || `Campaign ${campaignId.slice(0, 6)}`,
//       subject,
//       body,
//       fromName: fromName || smtpConfig.user,
//       recipients,
//       totalRecipients: recipients.length,
//       dailyLimit: limit,
//       delayMs: delay,
//       smtpConfig,
//       status: 'pending', // pending | running | paused | completed | failed
//       createdAt: new Date().toISOString(),
//       startedAt: null,
//       completedAt: null,
//       // Analytics
//       sent: 0,
//       failed: 0,
//       pending: recipients.length,
//       logs: [], // { email, status, timestamp, error? }
//       dailyStats: {}, // { 'YYYY-MM-DD': { sent, failed } }
//       currentIndex: 0,
//     };

//     campaigns[campaignId] = campaign;

//     return res.json({
//       success: true,
//       campaignId,
//       campaign: sanitizeCampaign(campaign),
//     });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Start / Resume Campaign ────────────────────────────────────────────────
// const startCampaign = async (req, res) => {
//   const { campaignId } = req.params;
//   const campaign = campaigns[campaignId];
//   if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//   if (campaign.status === 'running') return res.status(400).json({ error: 'Campaign already running' });
//   if (campaign.status === 'completed') return res.status(400).json({ error: 'Campaign already completed' });

//   campaign.status = 'running';
//   campaign.startedAt = campaign.startedAt || new Date().toISOString();

//   // Respond immediately, run async
//   res.json({ success: true, message: 'Campaign started', campaign: sanitizeCampaign(campaign) });

//   // Run sending loop async (fire and forget)
//   runCampaign(campaignId).catch(err => {
//     const c = campaigns[campaignId];
//     if (c) { c.status = 'failed'; c.errorMessage = err.message; }
//   });
// };

// // ─── Pause Campaign ─────────────────────────────────────────────────────────
// const pauseCampaign = (req, res) => {
//   const { campaignId } = req.params;
//   const campaign = campaigns[campaignId];
//   if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//   if (campaign.status !== 'running') return res.status(400).json({ error: 'Campaign is not running' });
//   campaign.status = 'paused';
//   return res.json({ success: true, message: 'Campaign paused', campaign: sanitizeCampaign(campaign) });
// };

// // ─── Get Campaign Status / Analytics ───────────────────────────────────────
// const getCampaign = (req, res) => {
//   const { campaignId } = req.params;
//   const campaign = campaigns[campaignId];
//   if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//   return res.json(sanitizeCampaign(campaign));
// };

// // ─── Get All Campaigns ──────────────────────────────────────────────────────
// const getAllCampaigns = (req, res) => {
//   const list = Object.values(campaigns).map(sanitizeCampaign);
//   return res.json({ campaigns: list, total: list.length });
// };

// // ─── Delete Campaign ────────────────────────────────────────────────────────
// const deleteCampaign = (req, res) => {
//   const { campaignId } = req.params;
//   if (!campaigns[campaignId]) return res.status(404).json({ error: 'Campaign not found' });
//   delete campaigns[campaignId];
//   return res.json({ success: true, message: 'Campaign deleted' });
// };

// // ─── Test SMTP Connection ───────────────────────────────────────────────────
// const testSmtp = async (req, res) => {
//   try {
//     const { smtpConfig } = req.body;
//     if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
//       return res.status(400).json({ error: 'Provide smtpConfig with host, user, pass' });
//     }
//     const transporter = buildTransporter(smtpConfig);
//     await transporter.verify();
//     return res.json({ success: true, message: 'SMTP connection verified successfully!' });
//   } catch (err) {
//     return res.status(400).json({ success: false, error: `SMTP Error: ${err.message}` });
//   }
// };

// // ─── Get Daily Stats Summary ────────────────────────────────────────────────
// const getDailyStats = (req, res) => {
//   const { campaignId } = req.params;
//   const campaign = campaigns[campaignId];
//   if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

//   const stats = Object.entries(campaign.dailyStats).map(([date, data]) => ({
//     date,
//     ...data,
//   })).sort((a, b) => a.date.localeCompare(b.date));

//   return res.json({ campaignId, dailyStats: stats });
// };

// // ─── Core Async Sending Loop ────────────────────────────────────────────────
// async function runCampaign(campaignId) {
//   const campaign = campaigns[campaignId];
//   if (!campaign) return;

//   let transporter;
//   try {
//     transporter = buildTransporter(campaign.smtpConfig);
//   } catch (err) {
//     campaign.status = 'failed';
//     campaign.errorMessage = `SMTP setup failed: ${err.message}`;
//     return;
//   }

//   const { recipients, dailyLimit, delayMs } = campaign;

//   while (campaign.currentIndex < recipients.length) {
//     // Check if paused or cancelled
//     if (campaign.status === 'paused' || campaign.status === 'failed') break;

//     // Check daily limit
//     const sentToday = getTodaySent();
//     if (sentToday >= dailyLimit) {
//       campaign.status = 'paused';
//       campaign.pauseReason = `Daily limit of ${dailyLimit} reached. Resume tomorrow.`;
//       break;
//     }

//     const recipientEmail = recipients[campaign.currentIndex];
//     const timestamp = new Date().toISOString();
//     const d = today();

//     try {
//       await transporter.sendMail({
//         from: `"${campaign.fromName}" <${campaign.smtpConfig.user}>`,
//         to: recipientEmail,
//         subject: campaign.subject,
//         html: campaign.body.replace(/\n/g, '<br>'),
//         text: campaign.body,
//       });

//       campaign.sent++;
//       campaign.pending--;
//       incrementDailySent(1);

//       // Per-day stats
//       if (!campaign.dailyStats[d]) campaign.dailyStats[d] = { sent: 0, failed: 0 };
//       campaign.dailyStats[d].sent++;

//       campaign.logs.push({ email: recipientEmail, status: 'sent', timestamp });

//     } catch (err) {
//       campaign.failed++;
//       campaign.pending--;

//       if (!campaign.dailyStats[d]) campaign.dailyStats[d] = { sent: 0, failed: 0 };
//       campaign.dailyStats[d].failed++;

//       campaign.logs.push({
//         email: recipientEmail,
//         status: 'failed',
//         timestamp,
//         error: err.message,
//       });
//     }

//     campaign.currentIndex++;

//     // Delay between sends
//     if (campaign.currentIndex < recipients.length && campaign.status === 'running') {
//       await sleep(delayMs);
//     }
//   }

//   // Mark completed if all done
//   if (campaign.currentIndex >= recipients.length && campaign.status === 'running') {
//     campaign.status = 'completed';
//     campaign.completedAt = new Date().toISOString();
//     campaign.pending = 0;
//   }
// }

// // ─── Sanitize (remove SMTP creds from response) ─────────────────────────────
// const sanitizeCampaign = (c) => {
//   const { smtpConfig, ...rest } = c;
//   return {
//     ...rest,
//     smtpHost: smtpConfig?.host || '',
//     smtpUser: smtpConfig?.user ? `${smtpConfig.user.slice(0, 4)}****` : '',
//     successRate: c.sent + c.failed > 0
//       ? Math.round((c.sent / (c.sent + c.failed)) * 100)
//       : 0,
//     recentLogs: (c.logs || []).slice(-50), // last 50 logs
//   };
// };

// module.exports = {
//   createCampaign,
//   startCampaign,
//   pauseCampaign,
//   getCampaign,
//   getAllCampaigns,
//   deleteCampaign,
//   testSmtp,
//   getDailyStats,
// };
// const nodemailer = require('nodemailer');
// const { v4: uuidv4 } = require('uuid');
// const connectDB = require('../lib/connectDB');
// const Campaign = require('../models/Campaign');

// // ─── Helpers ───────────────────────────────────────────────────────────────
// const today = () => new Date().toISOString().slice(0, 10);

// const parseEmails = (raw) => {
//   if (!raw || typeof raw !== 'string') return [];
//   const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
//   const found = raw.match(emailRegex) || [];
//   return [...new Set(found.map(e => e.toLowerCase().trim()))];
// };

// const buildTransporter = (smtpConfig) => {
//   return nodemailer.createTransport({
//     host: smtpConfig.host,
//     port: parseInt(smtpConfig.port) || 587,
//     secure: smtpConfig.secure === true || String(smtpConfig.port) === '465',
//     auth: { user: smtpConfig.user, pass: smtpConfig.pass },
//     tls: { rejectUnauthorized: false },
//     connectionTimeout: 10000,
//     greetingTimeout: 8000,
//   });
// };

// const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// const sanitizeCampaign = (c) => {
//   const obj = c.toObject ? c.toObject() : { ...c };
//   const { smtpConfig, ...rest } = obj;
//   const sent   = rest.sent   || 0;
//   const failed = rest.failed || 0;
//   return {
//     ...rest,
//     smtpHost: smtpConfig?.host || '',
//     smtpUser: smtpConfig?.user ? smtpConfig.user.slice(0, 4) + '****' : '',
//     successRate: sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0,
//     recentLogs: (rest.logs || []).slice(-50),
//     logs: undefined,
//   };
// };

// // ─── Create Campaign ────────────────────────────────────────────────────────
// const createCampaign = async (req, res) => {
//   try {
//     await connectDB();
//     const { name, subject, body, fromName, emailsRaw, dailyLimit, delayMs, smtpConfig } = req.body;

//     if (!subject || !body || !emailsRaw || !smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
//       return res.status(400).json({ error: 'Missing required fields: subject, body, emails, smtpConfig (host/user/pass)' });
//     }

//     const recipients = parseEmails(emailsRaw);
//     if (recipients.length === 0) {
//       return res.status(400).json({ error: 'No valid email addresses found.' });
//     }

//     const campaignId = uuidv4();
//     const campaign = await Campaign.create({
//       id: campaignId,
//       name: name || `Campaign ${campaignId.slice(0, 6)}`,
//       subject, body,
//       fromName: fromName || smtpConfig.user,
//       recipients,
//       totalRecipients: recipients.length,
//       dailyLimit: parseInt(dailyLimit) || 100,
//       delayMs: parseInt(delayMs) || 1500,
//       smtpConfig,
//       status: 'pending',
//       createdAt: new Date().toISOString(),
//       sent: 0, failed: 0,
//       pending: recipients.length,
//       logs: [],
//       dailyStats: [],
//       currentIndex: 0,
//     });

//     return res.json({ success: true, campaignId, campaign: sanitizeCampaign(campaign) });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Start / Resume Campaign ────────────────────────────────────────────────
// const startCampaign = async (req, res) => {
//   try {
//     await connectDB();
//     const { campaignId } = req.params;
//     const campaign = await Campaign.findOne({ id: campaignId });
//     if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//     if (campaign.status === 'running')   return res.status(400).json({ error: 'Campaign already running' });
//     if (campaign.status === 'completed') return res.status(400).json({ error: 'Campaign already completed' });

//     campaign.status = 'running';
//     campaign.startedAt = campaign.startedAt || new Date().toISOString();
//     campaign.pauseReason = null;
//     await campaign.save();

//     // Respond immediately, then run async sending
//     res.json({ success: true, message: 'Campaign started', campaign: sanitizeCampaign(campaign) });

//     // Fire-and-forget async send loop
//     runCampaign(campaignId).catch(async (err) => {
//       await Campaign.findOneAndUpdate({ id: campaignId }, {
//         status: 'failed', errorMessage: err.message,
//       });
//     });

//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Pause Campaign ─────────────────────────────────────────────────────────
// const pauseCampaign = async (req, res) => {
//   try {
//     await connectDB();
//     const { campaignId } = req.params;
//     const campaign = await Campaign.findOne({ id: campaignId });
//     if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//     if (campaign.status !== 'running') return res.status(400).json({ error: 'Campaign is not running' });

//     campaign.status = 'paused';
//     await campaign.save();
//     return res.json({ success: true, message: 'Campaign paused', campaign: sanitizeCampaign(campaign) });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Get Campaign ────────────────────────────────────────────────────────────
// const getCampaign = async (req, res) => {
//   try {
//     await connectDB();
//     const campaign = await Campaign.findOne({ id: req.params.campaignId });
//     if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//     return res.json(sanitizeCampaign(campaign));
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Get All Campaigns ───────────────────────────────────────────────────────
// const getAllCampaigns = async (req, res) => {
//   try {
//     await connectDB();
//     const list = await Campaign.find({}).sort({ createdAt: -1 }).select('-logs -recipients');
//     return res.json({ campaigns: list.map(sanitizeCampaign), total: list.length });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Delete Campaign ─────────────────────────────────────────────────────────
// const deleteCampaign = async (req, res) => {
//   try {
//     await connectDB();
//     const result = await Campaign.deleteOne({ id: req.params.campaignId });
//     if (result.deletedCount === 0) return res.status(404).json({ error: 'Campaign not found' });
//     return res.json({ success: true, message: 'Campaign deleted' });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Test SMTP ───────────────────────────────────────────────────────────────
// const testSmtp = async (req, res) => {
//   try {
//     const { smtpConfig } = req.body;
//     if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
//       return res.status(400).json({ error: 'Provide smtpConfig with host, user, pass' });
//     }
//     const transporter = buildTransporter(smtpConfig);
//     await transporter.verify();
//     return res.json({ success: true, message: 'SMTP connection verified successfully!' });
//   } catch (err) {
//     return res.status(400).json({ success: false, error: `SMTP Error: ${err.message}` });
//   }
// };

// // ─── Get Daily Stats ─────────────────────────────────────────────────────────
// const getDailyStats = async (req, res) => {
//   try {
//     await connectDB();
//     const campaign = await Campaign.findOne({ id: req.params.campaignId }).select('id dailyStats');
//     if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
//     const stats = (campaign.dailyStats || []).slice().sort((a, b) => a.date.localeCompare(b.date));
//     return res.json({ campaignId: req.params.campaignId, dailyStats: stats });
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// };

// // ─── Core Async Sending Loop ────────────────────────────────────────────────
// // NOTE: On Render (persistent server) this runs fully.
// // On Vercel (serverless) each function call has ~60s max — the loop runs
// // as far as it can per invocation and saves progress to MongoDB, so
// // the next "Start/Resume" click picks up exactly where it left off.
// async function runCampaign(campaignId) {
//   await connectDB();
//   const campaign = await Campaign.findOne({ id: campaignId });
//   if (!campaign) return;

//   let transporter;
//   try {
//     transporter = buildTransporter(campaign.smtpConfig);
//     await transporter.verify();
//   } catch (err) {
//     await Campaign.findOneAndUpdate({ id: campaignId }, {
//       status: 'failed',
//       errorMessage: `SMTP connection failed: ${err.message}`,
//     });
//     return;
//   }

//   const { dailyLimit, delayMs } = campaign;
//   let { currentIndex, sent, failed, pending } = campaign;

//   // Count how many sent today from dailyStats
//   const d = today();
//   const todayStatIdx = campaign.dailyStats.findIndex(s => s.date === d);
//   let sentTodayCount = todayStatIdx >= 0 ? campaign.dailyStats[todayStatIdx].sent : 0;

//   while (currentIndex < campaign.recipients.length) {
//     // Re-read status from DB to catch pause signals
//     const fresh = await Campaign.findOne({ id: campaignId }).select('status');
//     if (!fresh || fresh.status === 'paused' || fresh.status === 'failed') break;

//     // Check daily limit
//     if (sentTodayCount >= dailyLimit) {
//       await Campaign.findOneAndUpdate({ id: campaignId }, {
//         status: 'paused',
//         pauseReason: `Daily limit of ${dailyLimit} reached. Click Resume tomorrow to continue.`,
//         currentIndex, sent, failed, pending,
//       });
//       return;
//     }

//     const recipientEmail = campaign.recipients[currentIndex];
//     const timestamp = new Date().toISOString();
//     const newLog = { email: recipientEmail, timestamp };

//     try {
//       await transporter.sendMail({
//         from: `"${campaign.fromName}" <${campaign.smtpConfig.user}>`,
//         to: recipientEmail,
//         subject: campaign.subject,
//         html: campaign.body.replace(/\n/g, '<br>'),
//         text: campaign.body,
//       });

//       sent++;
//       pending = Math.max(0, pending - 1);
//       sentTodayCount++;
//       newLog.status = 'sent';

//       // Update daily stat
//       const todayStat = campaign.dailyStats.find(s => s.date === d);
//       if (todayStat) { todayStat.sent++; } else { campaign.dailyStats.push({ date: d, sent: 1, failed: 0 }); }

//     } catch (err) {
//       failed++;
//       pending = Math.max(0, pending - 1);
//       newLog.status = 'failed';
//       newLog.error = err.message;

//       const todayStat = campaign.dailyStats.find(s => s.date === d);
//       if (todayStat) { todayStat.failed++; } else { campaign.dailyStats.push({ date: d, sent: 0, failed: 1 }); }
//     }

//     // Keep logs array to last 200 entries to avoid doc bloat
//     campaign.logs.push(newLog);
//     if (campaign.logs.length > 200) campaign.logs.splice(0, campaign.logs.length - 200);

//     currentIndex++;

//     // Persist progress every 5 sends (balance between durability and performance)
//     if (currentIndex % 5 === 0 || currentIndex >= campaign.recipients.length) {
//       await Campaign.findOneAndUpdate({ id: campaignId }, {
//         sent, failed, pending,
//         currentIndex,
//         logs: campaign.logs,
//         dailyStats: campaign.dailyStats,
//       });
//     }

//     // Delay between sends
//     if (currentIndex < campaign.recipients.length) {
//       await sleep(delayMs);
//     }
//   }

//   // Final save
//   const isComplete = currentIndex >= campaign.recipients.length;
//   await Campaign.findOneAndUpdate({ id: campaignId }, {
//     status: isComplete ? 'completed' : 'paused',
//     completedAt: isComplete ? new Date().toISOString() : null,
//     sent, failed, pending: isComplete ? 0 : pending,
//     currentIndex,
//     logs: campaign.logs,
//     dailyStats: campaign.dailyStats,
//   });
// }

// module.exports = {
//   createCampaign, startCampaign, pauseCampaign,
//   getCampaign, getAllCampaigns, deleteCampaign,
//   testSmtp, getDailyStats,
// };


const nodemailer  = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const connectDB   = require('../lib/connectDB');
const Campaign    = require('../models/Campaign');

// ─── Helpers ───────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);

const parseEmails = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  const found = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(found.map(e => e.toLowerCase().trim()))];
};

const buildTransporter = (cfg) =>
  nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port) || 587,
    secure: cfg.secure === true || String(cfg.port) === '465',
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 12000,
    greetingTimeout: 8000,
  });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const sanitize = (doc) => {
  const c = doc.toObject ? doc.toObject() : { ...doc };
  const sent = c.sent || 0, failed = c.failed || 0;
  return {
    id:               c.id,
    name:             c.name,
    subject:          c.subject,
    status:           c.status,
    totalRecipients:  c.totalRecipients,
    dailyLimit:       c.dailyLimit,
    delayMs:          c.delayMs,
    sent, failed,
    pending:          c.pending || 0,
    currentIndex:     c.currentIndex || 0,
    createdAt:        c.createdAt,
    startedAt:        c.startedAt,
    completedAt:      c.completedAt,
    pauseReason:      c.pauseReason || null,
    errorMessage:     c.errorMessage || null,
    dailyStats:       c.dailyStats || [],
    recentLogs:       (c.logs || []).slice(-50),
    smtpHost:         c.smtpConfig?.host || '',
    smtpUser:         c.smtpConfig?.user ? c.smtpConfig.user.slice(0, 4) + '****' : '',
    successRate:      sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0,
  };
};

// ─── Create Campaign ────────────────────────────────────────────────────────
const createCampaign = async (req, res) => {
  try {
    await connectDB();
    const { name, subject, body, fromName, emailsRaw, dailyLimit, delayMs, smtpConfig } = req.body;

    if (!subject || !body || !emailsRaw) {
      return res.status(400).json({ error: 'subject, body and emails are required.' });
    }
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      return res.status(400).json({ error: 'smtpConfig requires host, user and pass.' });
    }

    const recipients = parseEmails(emailsRaw);
    if (!recipients.length) return res.status(400).json({ error: 'No valid email addresses found.' });

    const id = uuidv4();
    const doc = await Campaign.create({
      id, subject, body,
      name:            name || `Campaign ${id.slice(0, 6)}`,
      fromName:        fromName || smtpConfig.user,
      recipients,
      totalRecipients: recipients.length,
      dailyLimit:      Math.max(1, parseInt(dailyLimit) || 100),
      delayMs:         Math.max(100, parseInt(delayMs) || 1500),
      smtpConfig,
      status:          'pending',
      createdAt:       new Date().toISOString(),
      sent: 0, failed: 0, pending: recipients.length,
      logs: [], dailyStats: [], currentIndex: 0,
    });

    return res.json({ success: true, campaignId: id, campaign: sanitize(doc) });
  } catch (err) {
    console.error('[createCampaign]', err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── Start / Resume ─────────────────────────────────────────────────────────
const startCampaign = async (req, res) => {
  try {
    await connectDB();
    const doc = await Campaign.findOne({ id: req.params.campaignId });
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    if (doc.status === 'running')   return res.status(400).json({ error: 'Already running' });
    if (doc.status === 'completed') return res.status(400).json({ error: 'Already completed' });

    doc.status     = 'running';
    doc.startedAt  = doc.startedAt || new Date().toISOString();
    doc.pauseReason = null;
    await doc.save();

    // Respond before starting the loop
    res.json({ success: true, message: 'Campaign started', campaign: sanitize(doc) });

    // Async fire-and-forget (works on Render; on Vercel runs until 60s timeout then user resumes)
    runCampaign(req.params.campaignId).catch(async (err) => {
      console.error('[runCampaign error]', err.message);
      await Campaign.findOneAndUpdate({ id: req.params.campaignId }, {
        status: 'failed', errorMessage: err.message,
      }).catch(() => {});
    });

  } catch (err) {
    console.error('[startCampaign]', err);
    return res.status(500).json({ error: err.message });
  }
};

// ─── Pause ──────────────────────────────────────────────────────────────────
const pauseCampaign = async (req, res) => {
  try {
    await connectDB();
    const doc = await Campaign.findOne({ id: req.params.campaignId });
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    if (doc.status !== 'running') return res.status(400).json({ error: 'Campaign is not running' });
    doc.status = 'paused';
    await doc.save();
    return res.json({ success: true, campaign: sanitize(doc) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Get One ────────────────────────────────────────────────────────────────
const getCampaign = async (req, res) => {
  try {
    await connectDB();
    const doc = await Campaign.findOne({ id: req.params.campaignId });
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    return res.json(sanitize(doc));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Get All ────────────────────────────────────────────────────────────────
const getAllCampaigns = async (req, res) => {
  try {
    await connectDB();
    const docs = await Campaign.find({}).sort({ createdAt: -1 }).select('-logs -recipients');
    return res.json({ campaigns: docs.map(sanitize), total: docs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Delete ─────────────────────────────────────────────────────────────────
const deleteCampaign = async (req, res) => {
  try {
    await connectDB();
    const result = await Campaign.deleteOne({ id: req.params.campaignId });
    if (!result.deletedCount) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Test SMTP ───────────────────────────────────────────────────────────────
const testSmtp = async (req, res) => {
  try {
    const { smtpConfig } = req.body;
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      return res.status(400).json({ error: 'Provide host, user and pass' });
    }
    const t = buildTransporter(smtpConfig);
    await t.verify();
    return res.json({ success: true, message: 'SMTP connection verified!' });
  } catch (err) {
    return res.status(400).json({ success: false, error: `SMTP Error: ${err.message}` });
  }
};

// ─── Daily Stats ─────────────────────────────────────────────────────────────
const getDailyStats = async (req, res) => {
  try {
    await connectDB();
    const doc = await Campaign.findOne({ id: req.params.campaignId }).select('dailyStats');
    if (!doc) return res.status(404).json({ error: 'Campaign not found' });
    const stats = [...(doc.dailyStats || [])].sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ campaignId: req.params.campaignId, dailyStats: stats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Core Send Loop ──────────────────────────────────────────────────────────
async function runCampaign(campaignId) {
  await connectDB();
  const campaign = await Campaign.findOne({ id: campaignId });
  if (!campaign) return;

  const transporter = buildTransporter(campaign.smtpConfig);
  try {
    await transporter.verify();
  } catch (err) {
    await Campaign.findOneAndUpdate({ id: campaignId }, {
      status: 'failed',
      errorMessage: `SMTP failed: ${err.message}`,
    });
    return;
  }

  let { currentIndex, sent, failed, pending } = campaign;
  const d = todayStr();

  // Count today's sends from dailyStats
  const todayStat = campaign.dailyStats.find(s => s.date === d);
  let sentToday = todayStat ? todayStat.sent : 0;

  while (currentIndex < campaign.recipients.length) {
    // Poll DB for pause signal every iteration
    const fresh = await Campaign.findOne({ id: campaignId }).select('status').lean();
    if (!fresh || fresh.status === 'paused' || fresh.status === 'failed') break;

    if (sentToday >= campaign.dailyLimit) {
      await Campaign.findOneAndUpdate({ id: campaignId }, {
        status: 'paused',
        pauseReason: `Daily limit of ${campaign.dailyLimit} reached. Click Resume tomorrow.`,
        currentIndex, sent, failed, pending,
      });
      return;
    }

    const email     = campaign.recipients[currentIndex];
    const timestamp = new Date().toISOString();
    const logEntry  = { email, timestamp, status: 'sent' };

    try {
      await transporter.sendMail({
        from:    `"${campaign.fromName}" <${campaign.smtpConfig.user}>`,
        to:      email,
        subject: campaign.subject,
        html:    campaign.body.replace(/\n/g, '<br>'),
        text:    campaign.body,
      });
      sent++;
      sentToday++;
      pending = Math.max(0, pending - 1);

      // Update daily stat in memory
      const ds = campaign.dailyStats.find(s => s.date === d);
      if (ds) ds.sent++; else campaign.dailyStats.push({ date: d, sent: 1, failed: 0 });

    } catch (err) {
      logEntry.status = 'failed';
      logEntry.error  = err.message;
      failed++;
      pending = Math.max(0, pending - 1);

      const ds = campaign.dailyStats.find(s => s.date === d);
      if (ds) ds.failed++; else campaign.dailyStats.push({ date: d, sent: 0, failed: 1 });
    }

    campaign.logs.push(logEntry);
    // Cap logs to 200 to avoid MongoDB doc size limit
    if (campaign.logs.length > 200) campaign.logs.splice(0, campaign.logs.length - 200);

    currentIndex++;

    // Persist every 5 sends
    if (currentIndex % 5 === 0 || currentIndex >= campaign.recipients.length) {
      await Campaign.findOneAndUpdate({ id: campaignId }, {
        sent, failed, pending, currentIndex,
        logs:       campaign.logs,
        dailyStats: campaign.dailyStats,
      });
    }

    if (currentIndex < campaign.recipients.length) {
      await sleep(campaign.delayMs);
    }
  }

  const done = currentIndex >= campaign.recipients.length;
  await Campaign.findOneAndUpdate({ id: campaignId }, {
    status:      done ? 'completed' : 'paused',
    completedAt: done ? new Date().toISOString() : null,
    pending:     done ? 0 : pending,
    sent, failed, currentIndex,
    logs:        campaign.logs,
    dailyStats:  campaign.dailyStats,
  });
}

module.exports = {
  createCampaign, startCampaign, pauseCampaign,
  getCampaign, getAllCampaigns, deleteCampaign,
  testSmtp, getDailyStats,
};
