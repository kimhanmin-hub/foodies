const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { isLoggedIn, isMaster } = require('../middlewares/middleware');
const multer = require('multer');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

// 음식점 관리 라우트를 '/foodmanage'로 변경
router.get('/foodmanage', isMaster, restaurantController.manageFoodRestaurants);

router.get('/', restaurantController.getAllRestaurants);
router.get('/new', isLoggedIn, restaurantController.renderNewForm);
router.post('/', isLoggedIn, upload.array('image', 5), restaurantController.createRestaurant);
router.get('/:id', restaurantController.getRestaurant);
router.get('/:id/edit', isLoggedIn, restaurantController.renderEditForm);
router.put('/:id', isLoggedIn, restaurantController.updateRestaurant);
router.delete('/:id', isLoggedIn, restaurantController.deleteRestaurant);

module.exports = router;