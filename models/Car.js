const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  rentPrice: {
    type: Number,
    required: true
  },
  carType: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  seatCapacity: {
    type: Number,
    required: true
  },
  pickupLocation: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  availability: {
    type: Boolean,
    default: true
  },
  bookingCount: {
    type: Number,
    default: 0
  },
  addedBy: {
    type: String,
    required: true // User email or ID who added the car
  }
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);
