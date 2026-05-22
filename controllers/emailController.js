// ─── Remove Duplicates ───────────────────────────────────────────────────────
const removeDuplicates = (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || typeof emails !== 'string') {
      return res.status(400).json({ error: 'Please provide emails as a string.' });
    }

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const allFound = emails.match(emailRegex) || [];
    const normalized = allFound.map(e => e.toLowerCase().trim());

    const countMap = {};
    normalized.forEach(email => {
      countMap[email] = (countMap[email] || 0) + 1;
    });

    const uniqueEmails = Object.keys(countMap);
    const duplicates = Object.entries(countMap)
      .filter(([, count]) => count > 1)
      .map(([email, count]) => ({ email, count }));

    return res.json({
      totalEmails: normalized.length,
      uniqueCount: uniqueEmails.length,
      duplicateCount: duplicates.length,
      uniqueEmails,
      duplicates,
      cleanedList: uniqueEmails,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─── Shuffle Emails ───────────────────────────────────────────────────────────
const shuffleEmails = (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || typeof emails !== 'string') {
      return res.status(400).json({ error: 'Please provide emails as a string.' });
    }

    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const allFound = emails.match(emailRegex) || [];

    // Fisher-Yates shuffle
    const arr = [...allFound];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return res.json({
      original: allFound,
      shuffled: arr,
      total: arr.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { removeDuplicates, shuffleEmails };
