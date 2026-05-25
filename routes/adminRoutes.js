const express = require('express');
const router  = express.Router();
const { requireAdmin } = require('../lib/authMiddleware');
const {
  getAllUsers, getUserDetail, updateUser, toggleBlock,
  deleteUser, adminDeleteCampaign, getPlatformStats,
} = require('../controllers/adminController');

router.use(requireAdmin); // all admin routes require admin role

router.get('/stats',                          getPlatformStats);
router.get('/users',                          getAllUsers);
router.get('/users/:userId',                  getUserDetail);
router.put('/users/:userId',                  updateUser);
router.post('/users/:userId/toggle-block',    toggleBlock);
router.delete('/users/:userId',               deleteUser);
router.delete('/campaigns/:campaignId',       adminDeleteCampaign);

module.exports = router;
