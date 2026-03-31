const express = require('express');
const router = express.Router();
const { getUploadSignature } = require('../controllers/upload.controller');
const { authenticate } = require('../middleware/auth');

// GET /api/upload/signature
router.get('/signature', authenticate, getUploadSignature);

module.exports = router;
