const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const User = require('../models/User');
const { isLoggedIn, isMaster } = require('../middlewares/middleware');

// 회원 가입, 로그인, 로그아웃 라우트
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);
router.get('/logout', userController.logoutUser);

// 회원 관리 페이지
router.get('/manage', isLoggedIn, isMaster, async (req, res) => {
    const users = await User.find({});
    res.render('users/manage', { users });
});

// 회원 역할 변경
router.put('/manage/:id/role', isLoggedIn, isMaster, async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    await User.findByIdAndUpdate(id, { role });
    req.flash('success', '회원 역할이 변경되었습니다.');
    res.redirect('/users/manage');
});

// 회원 삭제
router.delete('/manage/:id', isLoggedIn, isMaster, async (req, res) => {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    req.flash('success', '회원이 삭제되었습니다.');
    res.redirect('/users/manage');
});

module.exports = router;