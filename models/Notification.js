// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
  },
  message: {
    type: String,
    required: [true, 'Message content is required'],
  },
  // Additional fields such as notification type, URL, etc. can be added as needed.
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
