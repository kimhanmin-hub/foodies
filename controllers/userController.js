const User = require('../models/User');
const passport = require('passport');

module.exports.registerUser = async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            req.flash('error', '이미 사용 중인 이메일 또는 사용자 이름입니다.');
            return res.redirect('/register');
        }
        const user = new User({ email, username });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash('success', '회원등록이 되었습니다!');
            res.redirect('/');
        });
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/register');
    }
};

module.exports.loginUser = passport.authenticate('local', {
    failureFlash: true,
    failureRedirect: '/login'
}), (req, res) => {
    req.flash('success', '로그인되었습니다!');
    res.redirect('/');
};

module.exports.logoutUser = (req, res) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success', '로그아웃되었습니다!');
        res.redirect('/');
    });
};

// 회원 관리 페이지
module.exports.manageUsers = async (req, res) => {
  try {
      const users = await User.find({}).sort({ createdAt: -1 });
      res.render('users/manage', { users, title: '회원 관리' });
  } catch (error) {
      console.error(error);
      req.flash('error', '회원 목록을 불러오는데 실패했습니다.');
      res.redirect('/');
  }
};

// 회원 역할 변경
module.exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    await User.findByIdAndUpdate(id, { role });
    req.flash('success', '회원 역할이 변경되었습니다.');
    res.redirect('/users/manage');
};

// 회원 삭제
module.exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    req.flash('success', '회원이 삭제되었습니다.');
    res.redirect('/users/manage');
};