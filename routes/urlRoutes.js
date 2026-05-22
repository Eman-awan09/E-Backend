const express = require('express');
const router = express.Router();
const { cleanUrls, extractEmailsFromUrls } = require('../controllers/urlController');

router.post('/clean', cleanUrls);
router.post('/extract-emails', extractEmailsFromUrls);

module.exports = router;
