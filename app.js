//set up the dependencies
var express = require('express');
var http = require('http');
var MongoClient = require('mongodb').MongoClient;
var path = require('path');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var passport = require('passport');
var sharedsession = require("express-socket.io-session");

//create the app
var app = express();
var server = http.createServer(app);

//set up socket.io
var io = require('socket.io')(server);

//setup db connections
mongoose.connect('mongodb://localhost:27017/drawandchat');
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () { console.log("Connected to DB!"); });

//setup sessions
var sessionConfig = session({
    secret: 'aykler',
    resave: true,
    saveUninitialized: false,
    cookie: { maxAge: 60000 * 10 }, //10 minutes
    store: new MongoStore({
        mongooseConnection: db
    })
});

app.use(sessionConfig);

io.use(sharedsession(sessionConfig, {
    autoSave: true
}));

app.use(passport.initialize());
app.use(passport.session());

//setup the application
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/login', express.static(path.join(__dirname, 'login')));
app.use('/home', express.static(path.join(__dirname, 'public')));
require('./routes/authenticator')(app, passport);
require('./routes/socket')(app, io);

//launch
server.listen(8080);