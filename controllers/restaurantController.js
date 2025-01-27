const Restaurant = require('../models/Restaurant');
const isValidObjectId = require('../utils/validateObjectId');

exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({}).populate('reviews');
    const restaurantsWithRatings = restaurants.map(restaurant => {
      const restaurantObject = restaurant.toObject({ virtuals: true });
      restaurantObject.averageRating = restaurant.averageRating;
      return restaurantObject;
    });
    res.render('restaurants/main', { 
      restaurants: restaurantsWithRatings, 
      currentPage: 1, 
      totalPages: 1 
    });
  } catch (error) {
    console.error(error);
    req.flash('error', '음식점 목록을 불러오는데 실패했습니다.');
    res.redirect('/');
  }
};

exports.getRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id).populate('reviews').populate('author');
    if (!restaurant) {
      req.flash('error', '해당 음식점을 찾을 수 없습니다.');
      return res.redirect('/restaurants');
    }
    res.render('restaurants/show', { restaurant });
  } catch (error) {
    console.error(error);
    req.flash('error', '음식점 정보를 불러오는데 실패했습니다.');
    res.redirect('/restaurants');
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { name, cuisine, description } = req.body;
    const newRestaurant = new Restaurant({
      name,
      cuisine,
      description,
      author: req.user._id
    });

    // 이미지 처리
    if (req.files && req.files.length > 0) {
      newRestaurant.images = req.files.map(file => ({
        url: file.path,
        filename: file.filename
      }));
    }

    await newRestaurant.save();
    req.flash('success', '새 음식점이 추가되었습니다!');
    res.redirect(`/restaurants/${newRestaurant._id}`);
  } catch (error) {
    console.error('Error details:', error);
    req.flash('error', '음식점 추가 중 오류가 발생했습니다.');
    res.redirect('/restaurants/new');
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    req.flash('success', '음식점 정보가 업데이트되었습니다.');
    res.redirect(`/restaurants/${restaurant._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', '음식점 정보 업데이트에 실패했습니다.');
    res.redirect(`/restaurants/${req.params.id}/edit`);
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    await Restaurant.findByIdAndDelete(id);
    req.flash('success', '음식점이 삭제되었습니다.');
    res.redirect('/restaurants');
  } catch (error) {
    console.error(error);
    req.flash('error', '음식점 삭제에 실패했습니다.');
    res.redirect(`/restaurants/${req.params.id}`);
  }
};

exports.renderNewForm = (req, res) => {
  res.render('restaurants/new');
};

exports.renderEditForm = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      req.flash('error', '해당 음식점을 찾을 수 없습니다.');
      return res.redirect('/restaurants');
    }
    res.render('restaurants/edit', { restaurant });
  } catch (error) {
    console.error(error);
    req.flash('error', '음식점 수정 페이지를 불러오는데 실패했습니다.');
    res.redirect('/restaurants');
  }
};

exports.manageFoodRestaurants = async (req, res) => {
    try {
        const restaurants = await Restaurant.find({}).populate('author').populate('reviews');
        res.render('restaurants/foodmanage', { restaurants });
    } catch (error) {
        console.error(error);
        req.flash('error', '음식점 관리 페이지를 불러오는데 실패했습니다.');
        res.redirect('/restaurants');
    }
};