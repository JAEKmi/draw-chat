var mongoose = require('mongoose');

var MessageSchema = new mongoose.Schema({
    senderID: String,
    receiverID: String,
    content: String,
    dateAdded: Date
});

module.exports = mongoose.model('Message', MessageSchema, 'messages');