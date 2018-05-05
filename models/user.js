var mongoose = require('mongoose');
var bcrypt = require('bcrypt');

var UserSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String
});

UserSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
};

// check whether if the password is valid or not
UserSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.password);
};

// create the model for users and expose it to our app
module.exports = mongoose.model('User', UserSchema, 'users');
