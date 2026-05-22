const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// ─── In-Memory Store (replace with DB in production) ──────────────────────
const campaigns = {}; // { [campaignId]: Campaign }
const dailySentLog = {}; // { [YYYY-MM-DD]: count }

// ─── Helpers ───────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const getTodaySent = () => dailySentLog[today()] || 0;

const incrementDailySent = (n = 1) => {
  const d = today();
  dailySentLog[d] = (dailySentLog[d] || 0) + n;
};

const parseEmails = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = raw.match(emailRegex) || [];
  return [...new Set(found.map(e => e.toLowerCase().trim()))];
};

const buildTransporter = (smtpConfig) => {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: parseInt(smtpConfig.port) || 587,
    secure: smtpConfig.secure === true || smtpConfig.port == 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
    tls: { rejectUnauthorized: false },
  });
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ─── Create Campaign ────────────────────────────────────────────────────────
const createCampaign = (req, res) => {
  try {
    const {
      name,
      subject,
      body,
      fromName,
      emailsRaw,
      dailyLimit,
      delayMs,
      smtpConfig,
    } = req.body;

    if (!subject || !body || !emailsRaw || !smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      return res.status(400).json({ error: 'Missing required fields: subject, body, emails, smtpConfig (host/user/pass)' });
    }

    const recipients = parseEmails(emailsRaw);
    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found.' });
    }

    const campaignId = uuidv4();
    const limit = parseInt(dailyLimit) || 100;
    const delay = parseInt(delayMs) || 1000;

    const campaign = {
      id: campaignId,
      name: name || `Campaign ${campaignId.slice(0, 6)}`,
      subject,
      body,
      fromName: fromName || smtpConfig.user,
      recipients,
      totalRecipients: recipients.length,
      dailyLimit: limit,
      delayMs: delay,
      smtpConfig,
      status: 'pending', // pending | running | paused | completed | failed
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      // Analytics
      sent: 0,
      failed: 0,
      pending: recipients.length,
      logs: [], // { email, status, timestamp, error? }
      dailyStats: {}, // { 'YYYY-MM-DD': { sent, failed } }
      currentIndex: 0,
    };

    campaigns[campaignId] = campaign;

    return res.json({
      success: true,
      campaignId,
      campaign: sanitizeCampaign(campaign),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Start / Resume Campaign ────────────────────────────────────────────────
const startCampaign = async (req, res) => {
  const { campaignId } = req.params;
  const campaign = campaigns[campaignId];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status === 'running') return res.status(400).json({ error: 'Campaign already running' });
  if (campaign.status === 'completed') return res.status(400).json({ error: 'Campaign already completed' });

  campaign.status = 'running';
  campaign.startedAt = campaign.startedAt || new Date().toISOString();

  // Respond immediately, run async
  res.json({ success: true, message: 'Campaign started', campaign: sanitizeCampaign(campaign) });

  // Run sending loop async (fire and forget)
  runCampaign(campaignId).catch(err => {
    const c = campaigns[campaignId];
    if (c) { c.status = 'failed'; c.errorMessage = err.message; }
  });
};

// ─── Pause Campaign ─────────────────────────────────────────────────────────
const pauseCampaign = (req, res) => {
  const { campaignId } = req.params;
  const campaign = campaigns[campaignId];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.status !== 'running') return res.status(400).json({ error: 'Campaign is not running' });
  campaign.status = 'paused';
  return res.json({ success: true, message: 'Campaign paused', campaign: sanitizeCampaign(campaign) });
};

// ─── Get Campaign Status / Analytics ───────────────────────────────────────
const getCampaign = (req, res) => {
  const { campaignId } = req.params;
  const campaign = campaigns[campaignId];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  return res.json(sanitizeCampaign(campaign));
};

// ─── Get All Campaigns ──────────────────────────────────────────────────────
const getAllCampaigns = (req, res) => {
  const list = Object.values(campaigns).map(sanitizeCampaign);
  return res.json({ campaigns: list, total: list.length });
};

// ─── Delete Campaign ────────────────────────────────────────────────────────
const deleteCampaign = (req, res) => {
  const { campaignId } = req.params;
  if (!campaigns[campaignId]) return res.status(404).json({ error: 'Campaign not found' });
  delete campaigns[campaignId];
  return res.json({ success: true, message: 'Campaign deleted' });
};

// ─── Test SMTP Connection ───────────────────────────────────────────────────
const testSmtp = async (req, res) => {
  try {
    const { smtpConfig } = req.body;
    if (!smtpConfig?.host || !smtpConfig?.user || !smtpConfig?.pass) {
      return res.status(400).json({ error: 'Provide smtpConfig with host, user, pass' });
    }
    const transporter = buildTransporter(smtpConfig);
    await transporter.verify();
    return res.json({ success: true, message: 'SMTP connection verified successfully!' });
  } catch (err) {
    return res.status(400).json({ success: false, error: `SMTP Error: ${err.message}` });
  }
};

// ─── Get Daily Stats Summary ────────────────────────────────────────────────
const getDailyStats = (req, res) => {
  const { campaignId } = req.params;
  const campaign = campaigns[campaignId];
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const stats = Object.entries(campaign.dailyStats).map(([date, data]) => ({
    date,
    ...data,
  })).sort((a, b) => a.date.localeCompare(b.date));

  return res.json({ campaignId, dailyStats: stats });
};

// ─── Core Async Sending Loop ────────────────────────────────────────────────
async function runCampaign(campaignId) {
  const campaign = campaigns[campaignId];
  if (!campaign) return;

  let transporter;
  try {
    transporter = buildTransporter(campaign.smtpConfig);
  } catch (err) {
    campaign.status = 'failed';
    campaign.errorMessage = `SMTP setup failed: ${err.message}`;
    return;
  }

  const { recipients, dailyLimit, delayMs } = campaign;

  while (campaign.currentIndex < recipients.length) {
    // Check if paused or cancelled
    if (campaign.status === 'paused' || campaign.status === 'failed') break;

    // Check daily limit
    const sentToday = getTodaySent();
    if (sentToday >= dailyLimit) {
      campaign.status = 'paused';
      campaign.pauseReason = `Daily limit of ${dailyLimit} reached. Resume tomorrow.`;
      break;
    }

    const recipientEmail = recipients[campaign.currentIndex];
    const timestamp = new Date().toISOString();
    const d = today();

    try {
      await transporter.sendMail({
        from: `"${campaign.fromName}" <${campaign.smtpConfig.user}>`,
        to: recipientEmail,
        subject: campaign.subject,
        html: campaign.body.replace(/\n/g, '<br>'),
        text: campaign.body,
      });

      campaign.sent++;
      campaign.pending--;
      incrementDailySent(1);

      // Per-day stats
      if (!campaign.dailyStats[d]) campaign.dailyStats[d] = { sent: 0, failed: 0 };
      campaign.dailyStats[d].sent++;

      campaign.logs.push({ email: recipientEmail, status: 'sent', timestamp });

    } catch (err) {
      campaign.failed++;
      campaign.pending--;

      if (!campaign.dailyStats[d]) campaign.dailyStats[d] = { sent: 0, failed: 0 };
      campaign.dailyStats[d].failed++;

      campaign.logs.push({
        email: recipientEmail,
        status: 'failed',
        timestamp,
        error: err.message,
      });
    }

    campaign.currentIndex++;

    // Delay between sends
    if (campaign.currentIndex < recipients.length && campaign.status === 'running') {
      await sleep(delayMs);
    }
  }

  // Mark completed if all done
  if (campaign.currentIndex >= recipients.length && campaign.status === 'running') {
    campaign.status = 'completed';
    campaign.completedAt = new Date().toISOString();
    campaign.pending = 0;
  }
}

// ─── Sanitize (remove SMTP creds from response) ─────────────────────────────
const sanitizeCampaign = (c) => {
  const { smtpConfig, ...rest } = c;
  return {
    ...rest,
    smtpHost: smtpConfig?.host || '',
    smtpUser: smtpConfig?.user ? `${smtpConfig.user.slice(0, 4)}****` : '',
    successRate: c.sent + c.failed > 0
      ? Math.round((c.sent / (c.sent + c.failed)) * 100)
      : 0,
    recentLogs: (c.logs || []).slice(-50), // last 50 logs
  };
};

module.exports = {
  createCampaign,
  startCampaign,
  pauseCampaign,
  getCampaign,
  getAllCampaigns,
  deleteCampaign,
  testSmtp,
  getDailyStats,
};
