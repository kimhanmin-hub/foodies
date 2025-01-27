const mongoose = require('mongoose');
const Review = require('./Review');
const Schema = mongoose.Schema;

const RestaurantSchema = new Schema({
    name: { type: String, required: true },
    cuisine: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ url: String, filename: String }],
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviews: [{ type: Schema.Types.ObjectId, ref: 'Review' }],
    location: {
        type: String,
        required: false
    }
});

RestaurantSchema.virtual('averageRating').get(function() {
    if (this.reviews.length === 0) {
        return 0;
    }
    const sum = this.reviews.reduce((total, review) => total + review.rating, 0);
    return (sum / this.reviews.length).toFixed(1);
});

RestaurantSchema.set('toJSON', { virtuals: true });
RestaurantSchema.set('toObject', { virtuals: true });

// 리뷰 삭제 시 해당 리뷰도 함께 삭제
RestaurantSchema.post('findOneAndDelete', async function(doc) {
    if (doc) {
        await Review.deleteMany({
            _id: {
                $in: doc.reviews
            }
        });
    }
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);