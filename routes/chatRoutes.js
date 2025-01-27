const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/room/:roomId', chatController.getChatRoom);
router.post('/message', chatController.sendMessage);

// ... 다른 채팅 관련 라우트들

module.exports = router;