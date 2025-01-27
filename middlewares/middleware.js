exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.session) {
        req.session.returnTo = req.originalUrl;
    }
    res.redirect('/login');
};

exports.isNotLoggedIn = (req, res, next) => {
    if (!req.session.userId) {
        next();
    } else {
        res.redirect('/');
    }
};

// 마스터 권한 확인 미들웨어 추가
exports.isMaster = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'master') {
        return next();
    }
    req.flash('error', '접근 권한이 없습니다.');
    res.redirect('/');
};

// ... 다른 미들웨어 함수들