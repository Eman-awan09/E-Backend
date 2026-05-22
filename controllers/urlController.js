const axios = require('axios');
const cheerio = require('cheerio');

// ─── URL Cleaner & Duplicate Remover ─────────────────────────────────────────
const cleanUrls = (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || typeof urls !== 'string') {
      return res.status(400).json({ error: 'Please provide URLs as a string.' });
    }

    const lines = urls.split(/\n|\r\n|\r/).map(l => l.trim()).filter(Boolean);

    const urlRegex = /^(https?:\/\/)?([\w\-]+\.)+[\w\-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;

    const blockedDomains = ['google.com', 'facebook.com'];

    const isBlocked = (url) => {
      try {
        const withProtocol = url.startsWith('http') ? url : 'https://' + url;
        const hostname = new URL(withProtocol).hostname.replace(/^www\./, '');
        return blockedDomains.some(blocked => hostname === blocked || hostname.endsWith('.' + blocked));
      } catch {
        return false;
      }
    };

    const valid = lines.filter(url => urlRegex.test(url) && !isBlocked(url));
    const unique = [...new Set(valid.map(u => u.toLowerCase()))];

    const removed = lines.filter(url => !urlRegex.test(url) || isBlocked(url));
    const duplicatesRemoved = valid.length - unique.length;

    return res.json({
      original: lines.length,
      cleaned: unique.length,
      duplicatesRemoved,
      blockedRemoved: removed.length,
      cleanUrls: unique,
      removedUrls: removed,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Extract Emails from URLs ─────────────────────────────────────────────────
const extractEmailsFromUrls = async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || typeof urls !== 'string') {
      return res.status(400).json({ error: 'Please provide URLs as a string.' });
    }

    const lines = urls.split(/\n|\r\n|\r/).map(l => l.trim()).filter(Boolean);

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const allEmails = new Set();
    const results = [];

    for (const rawUrl of lines) {
      const url = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
      const urlResult = { url, status: 'success', emails: [], error: null };

      try {
        const response = await axios.get(url, {
          timeout: 10000,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          },
          maxRedirects: 5,
        });

        const $ = cheerio.load(response.data);

        // Remove scripts and styles from text scrape
        $('script, style, noscript').remove();

        const pageText = $.html();
        const found = pageText.match(emailRegex) || [];
        const unique = [...new Set(found.map(e => e.toLowerCase().trim()))];

        urlResult.emails = unique;
        unique.forEach(e => allEmails.add(e));
      } catch (err) {
        urlResult.status = 'error';
        urlResult.error = err.message || 'Failed to fetch URL';
      }

      results.push(urlResult);
    }

    return res.json({
      totalUrls: lines.length,
      totalEmailsFound: allEmails.size,
      allUniqueEmails: [...allEmails],
      perUrlResults: results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { cleanUrls, extractEmailsFromUrls };
