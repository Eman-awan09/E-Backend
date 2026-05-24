const express = require('express');
const router  = express.Router();
const { register, login, verify, changePassword } = require('../controllers/authController');

router.post('/register',         register);
router.post('/login',            login);
router.get('/verify',            verify);
router.post('/change-password',  changePassword);

module.exports = router;
