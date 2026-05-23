// const express = require('express');
// const router = express.Router();
// const {
//   createCampaign,
//   startCampaign,
//   pauseCampaign,
//   getCampaign,
//   getAllCampaigns,
//   deleteCampaign,
//   testSmtp,
//   getDailyStats,
// } = require('../controllers/senderController');

// router.post('/test-smtp', testSmtp);
// router.post('/campaigns', createCampaign);
// router.get('/campaigns', getAllCampaigns);
// router.get('/campaigns/:campaignId', getCampaign);
// router.post('/campaigns/:campaignId/start', startCampaign);
// router.post('/campaigns/:campaignId/pause', pauseCampaign);
// router.delete('/campaigns/:campaignId', deleteCampaign);
// router.get('/campaigns/:campaignId/daily-stats', getDailyStats);

// module.exports = router;

const express = require('express');
const router  = express.Router();
const {
  createCampaign, startCampaign, pauseCampaign,
  sendNext,
  getCampaign, getAllCampaigns, deleteCampaign,
  testSmtp, getDailyStats,
} = require('../controllers/senderController');

router.post('/test-smtp',                        testSmtp);
router.post('/campaigns',                        createCampaign);
router.get('/campaigns',                         getAllCampaigns);
router.get('/campaigns/:campaignId',             getCampaign);
router.post('/campaigns/:campaignId/start',      startCampaign);
router.post('/campaigns/:campaignId/pause',      pauseCampaign);
router.post('/campaigns/:campaignId/send-next',  sendNext);   // ← NEW
router.delete('/campaigns/:campaignId',          deleteCampaign);
router.get('/campaigns/:campaignId/daily-stats', getDailyStats);

module.exports = router;