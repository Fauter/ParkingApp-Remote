const express = require('express');
const router = express.Router();
const configController = require('../controllers/configControllers');

router.get('/', configController.getConfig);

module.exports = router;
