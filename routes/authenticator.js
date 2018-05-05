module.exports = function (app, passport) {
    var LocalStrategy = require('passport-local').Strategy;
    var User = require('../models/user');
    var bcrypt = require('bcrypt');

    passport.serializeUser(function (user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });

    passport.use('login', new LocalStrategy({ passReqToCallback: true }, function (req, username, password, done) {
        //use login strategy if the login form was submitted by the user
        if (req.body.type == 'login') {
            User.findOne({ username: username }, function (err, user) {
                if (err)
                    return done(err);
                if (!user) 
                    return done(null, false, { message: 'Incorrect username.' });
                if (user.validPassword(password) == false) 
                    return done(null, false, { message: 'Incorrect password.' });
                return done(null, user);
            });
        }
        else if (req.body.type == 'register') {
            //save the credentials of the user
            User.create({
                email: req.body.email,
                username: req.body.username,
                password: bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10), null)
            }, function (err, instance) {
                if (err) 
                    throw err;
                //this call needs to take place inside the callback of the create function otherwise 
                //it would be executed earlier which would lead to not finding the new user in the DB
                User.findOne({ username: req.body.username }, function (err, user) {
                    if (err)
                        return done(err);
                    return done(null, user);
                });
            });
        }
    }));

    app.get('/logout', function (req, res) {
        req.session.destroy(function (err) {
            if (err)
                next(err);
            res.redirect('/login');
        });
    });

    app.get('/', function (req, res) {
        if (req.isAuthenticated()) {
            if (req.session.afterAJAX == true) {
                req.session.afterAJAX = false;
                res.send({ redirect: '/home' });
            }
            else
                res.redirect('/home');
        } else
            res.redirect('/login');
    });

    app.post('/login', passport.authenticate('login'), function (req, res) {
        req.session.user = req.user;
        //this is necessary for the root route to be able to decide which redirect method to use
        req.session.afterAJAX = true;
        req.session.save(function (err) {
            if (err)
                next(err);
            res.redirect('/');
        });
    });
}