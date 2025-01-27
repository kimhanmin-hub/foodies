const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({
    body: String,
    rating: Number,
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    image: { url: String, filename: String } // 새로 추가
}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);