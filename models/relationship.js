var mongoose = require('mongoose');

var RelationSchema = new mongoose.Schema({
  userID: String,
  friendID: String,
  status: String
});

module.exports = mongoose.model('Relation', RelationSchema, 'friendslist');
