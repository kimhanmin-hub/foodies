require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/User');
const Restaurant = require('./models/Restaurant');
const Review = require('./models/Review');
const mongoSanitize = require('express-mongo-sanitize');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { isLoggedIn, isMaster } = require('./middlewares/middleware');
const axios = require('axios');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/restaurant_app')
    .then(() => console.log('MongoDB에 연결되었습니다.'))
    .catch(err => console.error('MongoDB 연결 오류:', err));

// 뷰 엔진 및 미들웨어 설정
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(mongoSanitize());

// 세션 및 Passport 설정
const sessionConfig = {
    name: 'session',
    secret: process.env.SESSION_SECRET || 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};
app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// 로컬 변수 설정
app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// Multer 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// 라우트
app.get('/', (req, res) => res.render('restaurants/index', { currentUser: req.user }));
app.get('/home', (req, res) => res.render('home', { currentUser: req.user }));
app.get('/register', (req, res) => res.render('users/register', { currentUser: req.user }));
app.get('/login', (req, res) => res.render('users/login', { currentUser: req.user }));

// 회원가입
app.post('/register', async (req, res, next) => {
    try {
        const { email, username, password } = req.body;
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
});

// 로그인
app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    req.flash('success', '로그인되었습니다!');
    res.redirect('/');
});

// 로그아웃
app.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash('success', '로그아웃되었습니다!');
        res.redirect('/');
    });
});

// 음식점 관리 페이지 (이 라우트를 다른 /restaurants 라우트보다 먼저 배치)
app.get('/restaurants/foodmanage', isLoggedIn, isMaster, async (req, res) => {
    try {
        const restaurants = await Restaurant.find({}).populate('author', 'username');
        res.render('restaurants/foodmanage', { restaurants, title: '음식점 관리' });
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 목록을 불러오는데 실패했습니다.');
        res.redirect('/');
    }
});

// 음식점 목록
app.get('/restaurants', async (req, res) => {
    try {
        const perPage = 12;
        const page = parseInt(req.query.page) || 1;
        const totalRestaurants = await Restaurant.countDocuments({});
        const totalPages = Math.ceil(totalRestaurants / perPage);
        const restaurants = await Restaurant.find({})
            .populate('reviews')
            .skip((perPage * page) - perPage)
            .limit(perPage);

        const restaurantsWithRatings = restaurants.map(restaurant => {
            const restaurantObj = restaurant.toObject();
            if (restaurant.reviews.length > 0) {
                const sum = restaurant.reviews.reduce((total, review) => total + review.rating, 0);
                restaurantObj.averageRating = (sum / restaurant.reviews.length).toFixed(1);
            } else {
                restaurantObj.averageRating = '0.0';
            }
            return restaurantObj;
        });

        res.render('restaurants/main', {
            restaurants: restaurantsWithRatings,
            title: '모든 음식점',
            currentUser: req.user,
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 목록을 불러오는데 실패했습니다.');
        res.redirect('/');
    }
});

// 새 음식점 추가 페이지
app.get('/restaurants/new', isLoggedIn, (req, res) => {
    res.render('restaurants/new', { title: '새 음식점 추가', currentUser: req.user });
});

app.post('/restaurants', isLoggedIn, upload.array('image', 5), async (req, res) => {
    try {
        const { name, cuisine, description } = req.body;

        const newRestaurant = new Restaurant({
            name,
            cuisine,
            description,
            author: req.user._id // 현재 로그인한 사용자의 ID
        });

        // 이미지 처리 및 저장 로직
        if (req.files && req.files.length > 0) {
            newRestaurant.images = req.files.map(f => ({ url: `/uploads/${f.filename}`, filename: f.filename }));
        }

        await newRestaurant.save();
        req.flash('success', '새 음식점이 추가되었습니다!');
        res.redirect(`/restaurants/${newRestaurant._id}`);
    } catch (error) {
        console.error('Error details:', error);
        req.flash('error', '음식점 추가 중 오류가 발생했습니다.');
        res.redirect('/restaurants/new');
    }
});

// 음식점 상세 페이지
app.get('/restaurants/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id).populate({
            path: 'reviews',
            populate: {
                path: 'author'
            }
        }).populate('author');

        if (!restaurant) {
            req.flash('error', '해당 음식점을 찾을 수 없습니다.');
            return res.redirect('/restaurants');
        }

        // 평균 평점 계산
        let avgRating = 0;
        if (restaurant.reviews.length > 0) {
            const sum = restaurant.reviews.reduce((acc, review) => acc + review.rating, 0);
            avgRating = (sum / restaurant.reviews.length).toFixed(1);
        }

        res.render('restaurants/show', { 
            restaurant, 
            avgRating,
            naverClientId: process.env.NAVER_CLIENT_ID 
        });
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 정보를 불러오는데 실패했습니다.');
        res.redirect('/restaurants');
    }
});

// 음식점 수정 페이지
app.get('/restaurants/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            req.flash('error', '해당 음식점을 찾을 수 없습니다.');
            return res.redirect('/restaurants');
        }
        if (!restaurant.author.equals(req.user._id) && req.user.role !== 'master') {
            req.flash('error', '해당 음식점을 수정할 권한이 없습니다.');
            return res.redirect(`/restaurants/${req.params.id}`);
        }
        res.render('restaurants/edit', { restaurant });
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 수정 페이지를 불러오는데 실패했습니다.');
        res.redirect('/restaurants');
    }
});

// 음식점 수정 처리
app.put('/restaurants/:id', isLoggedIn, upload.array('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const restaurant = await Restaurant.findById(id);
        if (!restaurant.author.equals(req.user._id) && req.user.role !== 'master') {
            req.flash('error', '해당 음식점을 수정할 권한이 없습니다.');
            return res.redirect(`/restaurants/${id}`);
        }
        const { name, cuisine, description } = req.body;
        const updatedRestaurant = await Restaurant.findByIdAndUpdate(id, {
            name,
            cuisine,
            description
        }, { new: true });
        if (req.files && req.files.length > 0) {
            const imgs = req.files.map(f => ({ url: `/uploads/${f.filename}`, filename: f.filename }));
            updatedRestaurant.images.push(...imgs);
            await updatedRestaurant.save();
        }
        req.flash('success', '음식점 정보가 성공적으로 수정되었습니다.');
        res.redirect(`/restaurants/${updatedRestaurant._id}`);
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 수정에 실패했습니다.');
        res.redirect(`/restaurants/${req.params.id}/edit`);
    }
});

// 음식점 삭제
app.delete('/restaurants/:id', isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const restaurant = await Restaurant.findById(id);
        if (!restaurant.author.equals(req.user._id) && req.user.role !== 'master') {
            req.flash('error', '해당 음식점을 삭제할 권한이 없습니다.');
            return res.redirect(`/restaurants/${id}`);
        }
        await Restaurant.findByIdAndDelete(id);
        req.flash('success', '음식점이 성공적으로 삭제되었습니다.');
        res.redirect('/restaurants');
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 삭제에 실패했습니다.');
        res.redirect(`/restaurants/${req.params.id}`);
    }
});

// 리뷰 추가
app.post('/restaurants/:id/reviews', isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        const review = new Review(req.body.review);
        review.author = req.user._id;
        if (req.file) {
            review.image = { url: `/uploads/${req.file.filename}`, filename: req.file.filename };
        }
        restaurant.reviews.push(review);
        await review.save();
        await restaurant.save();
        req.flash('success', '새로운 리뷰가 추가되었습니다!');
        res.redirect(`/restaurants/${restaurant._id}`);
    } catch (error) {
        console.error(error);
        req.flash('error', '리뷰 추가에 실패했습니다.');
        res.redirect(`/restaurants/${req.params.id}`);
    }
});

// 리뷰 수정 페이지
app.get('/restaurants/:id/reviews/:reviewId/edit', isLoggedIn, async (req, res) => {
    try {
        const { id, reviewId } = req.params;
        const restaurant = await Restaurant.findById(id);
        const review = await Review.findById(reviewId);
        if (!restaurant || !review) {
            req.flash('error', '음식점 또는 리뷰를 찾을 수 없습니다.');
            return res.redirect('/restaurants');
        }
        if (!review.author.equals(req.user._id)) {
            req.flash('error', '해당 리뷰를 수정할 권한이 없습니다.');
            return res.redirect(`/restaurants/${id}`);
        }
        res.render('reviews/edit', { restaurant, review });
    } catch (error) {
        console.error(error);
        req.flash('error', '리뷰 수정 페이지를 불러오는데 실패했습니다.');
        res.redirect(`/restaurants/${req.params.id}`);
    }
});

// 리뷰 수정 처리
app.put('/restaurants/:id/reviews/:reviewId', isLoggedIn, upload.single('image'), async (req, res) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(req.user._id)) {
        req.flash('error', '해당 리뷰를 수정할 권한이 없습니다.');
        return res.redirect(`/restaurants/${id}`);
    }
    const { rating, body } = req.body.review;
    review.rating = rating;
    review.body = body;
    if (req.file) {
        review.image = { url: `/uploads/${req.file.filename}`, filename: req.file.filename };
    }
    await review.save();
    req.flash('success', '리뷰가 성공적으로 수정되었습니다.');
    res.redirect(`/restaurants/${id}`);
});

// 리뷰 삭제 (본인 리뷰만)
app.delete('/restaurants/:id/reviews/:reviewId', isLoggedIn, async (req, res) => {
    const { id, reviewId } = req.params;
    const review = await Review.findById(reviewId);
    if (!review.author.equals(req.user._id) && req.user.role !== 'master') {
        req.flash('error', '해당 리뷰를 삭제할 권한이 없습니다.');
        return res.redirect(`/restaurants/${id}`);
    }
    await Restaurant.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash('success', '리뷰가 성공적으로 삭제되었습니다.');
    res.redirect(`/restaurants/${id}`);
});

// 채팅 페이지
app.get('/chat', isLoggedIn, (req, res) => {
    res.render('chat', { title: '실시간 채팅', currentUser: req.user });
});

// Socket.IO 연결 처리
io.on('connection', (socket) => {
    console.log('사용자가 연결되었습니다.');

    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    socket.on('disconnect', () => {
        console.log('사용자가 연결을 끊었습니다.');
    });
});

// 회원 관리 페이지
app.get('/users/manage', isLoggedIn, isMaster, async (req, res) => {
    try {
        const users = await User.find({});
        res.render('users/manage', { users, title: '회원 관리' });
    } catch (error) {
        console.error(error);
        req.flash('error', '회원 목록을 불러오는데 실패했습니다.');
        res.redirect('/');
    }
});

// 역할 변경
app.put('/users/manage/:id/role', isLoggedIn, isMaster, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        await User.findByIdAndUpdate(id, { role });
        req.flash('success', '사용자 역할이 변경되었습니다.');
        res.redirect('/users/manage');
    } catch (error) {
        console.error(error);
        req.flash('error', '사용자 역할 변경에 실패했습니다.');
        res.redirect('/users/manage');
    }
});

// 사용자 삭제
app.delete('/users/manage/:id', isLoggedIn, isMaster, async (req, res) => {
    try {
        const { id } = req.params;
        await User.findByIdAndDelete(id);
        req.flash('success', '사용자가 삭제되었습니다.');
        res.redirect('/users/manage');
    } catch (error) {
        console.error(error);
        req.flash('error', '사용자 삭제에 실패했습니다.');
        res.redirect('/users/manage');
    }
});

// 회원정보 수정 페이지
app.get('/users/:id/edit', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            req.flash('error', '사용자를 찾을 수 없습니다.');
            return res.redirect('/');
        }
        if (!user._id.equals(req.user._id)) {
            req.flash('error', '다른 사용자의 정보를 수정할 수 없습니다.');
            return res.redirect('/');
        }
        res.render('users/userEdit', { user, title: '회원정보 수정' });
    } catch (error) {
        console.error(error);
        req.flash('error', '회원정보 수정 페이지를 불러오는데 실패했습니다.');
        res.redirect('/');
    }
});

// 회원정보 수정 처리
app.put('/users/:id', isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email } = req.body;
        const user = await User.findById(id);
        if (!user) {
            req.flash('error', '사용자를 찾을 수 없습니다.');
            return res.redirect('/');
        }
        if (!user._id.equals(req.user._id)) {
            req.flash('error', '다른 사용자의 정보를 수정할 수 없습니다.');
            return res.redirect('/');
        }
        user.username = username;
        user.email = email;
        await user.save();
        req.flash('success', '회원정보가 성공적으로 수정되었습니다.');
        res.redirect('/');
    } catch (error) {
        console.error(error);
        req.flash('error', '회원정보 수정에 실패했습니다.');
        res.redirect(`/users/${req.params.id}/edit`);
    }
});

// 서버 시작
const port = process.env.PORT || 3000;
http.listen(port, () => {
    console.log(`서버가 포트 ${port}에서 실행 중입니다`);
});