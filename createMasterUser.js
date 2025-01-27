const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/restaurant_app', {
}).then(() => {
    console.log('MongoDB에 연결되었습니다.');
}).catch(err => {
    console.error('MongoDB 연결 오류:', err);
});

const createMasterUser = async () => {
    const username = 'mmm';
    const email = 'mmm@mmm.com';
    const password = 'mmm';

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
        console.log('이미 사용 중인 이메일 또는 사용자 이름입니다.');
        return;
    }

    const user = new User({ email, username, role: 'master' });
    await User.register(user, password);
    console.log('마스터 아이디가 생성되었습니다.');
};



createMasterUser().then(() => {
    mongoose.connection.close();
});