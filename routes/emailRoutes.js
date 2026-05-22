const express = require('express');
const router = express.Router();
const { removeDuplicates, shuffleEmails } = require('../controllers/emailController');

router.post('/remove-duplicates', removeDuplicates);
router.post('/shuffle', shuffleEmails);

module.exports = router;
