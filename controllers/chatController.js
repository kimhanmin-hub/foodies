// 실시간 채팅 기능을 위한 컨트롤러
const Chat = require('../models/Chat');

exports.getChatRoom = async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const messages = await Chat.find({ roomId }).sort('createdAt');
    res.render('chat/room', { roomId, messages });
  } catch (error) {
    console.error(error);
    res.status(500).send('채팅방을 불러오는 중 오류가 발생했습니다.');
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { roomId, userId, message } = req.body;
    const newMessage = new Chat({ roomId, userId, message });
    await newMessage.save();
    res.status(201).json(newMessage);
  } catch (error) {
    console.error(error);
    res.status(500).send('메시지 전송 중 오류가 발생했습니다.');
  }
};

// ... 다른 채팅 관련 컨트롤러 함수들