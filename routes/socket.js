module.exports = function (app, io) {
    //set up dependencies
    var promise = require('promise');
    var Message = require('../models/message');
    var User = require('../models/user');
    var Relations = require('../models/relationship');

    var connectedUsers = [];

    //define constructors here
    function user(username) {
        this.username = username;
        this.sockets = [];
    }

    //db query function with condition param
    function dbQuery(model, conditionObj) {
        return new promise(function (fulfill, reject) {
            model.where(conditionObj).exec(function (err, docs) {
                if (err)
                    reject(err);
                fulfill(docs);
            });
        });
    }

    //async function that builds up the friendslist object by querying the db with the given data set
    function getAllUsers(data){
        return new promise(function (fulfill, reject) {
            var friends = [], outerIdx = 0;
            data.forEach(function (element, index) {
                dbQuery(User, { _id: element.friendID }).then(function (result) {
                    var obj = {};
                    obj[result[0].username] = element.status;
                    friends.push(obj);
                    if (outerIdx == data.length - 1) 
                        fulfill(friends);

                    ++outerIdx;
                }, function (err) { throw err; });
            });
        });
    }

    //handle the io connection
    io.on('connection', function (socket) {
        //generate the user's friendslist
        dbQuery(Relations, { userID: socket.handshake.session.user._id }).then(function (data) {
            getAllUsers(data).then(function (list) {
                //broadcast both the username and the list to the client's browser
                io.sockets.connected[socket.id].emit('personalData', { username: socket.handshake.session.user.username, friendslist: list });
            }, function (err) { throw err; });
        }, function (err) { throw err; });

        //whenever a user joins add it to the connected ones
        if (connectedUsers[socket.handshake.session.passport.user])
            connectedUsers[socket.handshake.session.passport.user].sockets.push(socket.id);
        else {
            connectedUsers[socket.handshake.session.passport.user] = new user(socket.handshake.session.user.username);
            connectedUsers[socket.handshake.session.passport.user].sockets.push(socket.id);
        }

        //set activeChatPartner field here
        socket.on('partner change', function (username) {
            //set up the activePartner object based on the given username
            dbQuery(User, { username: username }).then(function (data) {
                //the activepartner field is the id of the user from the db
                socket.handshake.session.user.activePartner = { id: data[0]._id, username: username };
                socket.handshake.session.save();
                return socket.handshake.session.user;
            }, function (err) { throw err; }).then(function (client) {
                //set up the chat history of the user
                var partnerID = client.activePartner.id;
                dbQuery(Message, { $or: [{ senderID: partnerID, receiverID: client._id }, { senderID: client._id, receiverID: partnerID }] }).then(function (data) {
                    //take out the messages only
                    var messagesOnly = [];
                    data.forEach(function (elem) {
                        if (elem.senderID == client._id)
                            messagesOnly.push(client.username + ": " + elem.content);
                        else
                            messagesOnly.push(username + ": " + elem.content);
                    });
                    //emit the message history object
                    io.sockets.connected[socket.id].emit('chat history', messagesOnly);
                }, function (err) { throw err; });
            });
        });

        //handle incoming chat messages
        socket.on('chat message', function (message) {
            //add the message to the collection
            Message.create({
                senderID: socket.handshake.session.user._id,
                receiverID: socket.handshake.session.user.activePartner.id,
                content: message,
                dateAdded: Date.now()
            }, function (err, instance) { if (err) { throw err; } });

            //wrap the content in an object which contains both the sender and the consignee
            var consignee = (socket.handshake.session.user.activePartner || { id: null, username: null });
            var contentObj = {
                from: socket.handshake.session.user.username,
                to: consignee.username,
                content: message
            }
            //distribute the message to all sockets of the client
            connectedUsers[socket.handshake.session.passport.user].sockets.forEach(function (sid) {
                io.sockets.connected[sid].emit('chat message', contentObj);
            });

            //distribute the message to all of the sockets of the partner
            if (connectedUsers[consignee.id])
                connectedUsers[consignee.id].sockets.forEach(function (sid) {
                    io.sockets.connected[sid].emit('chat message', contentObj);
                });
        });

        //handle drawing board changes here
        socket.on('emit_draw', function (path, options) {
            //content wrapper object
            var consignee = (socket.handshake.session.user.activePartner || { id: null, username: null });
            var contentObj = {
                from: socket.handshake.session.user.username,
                to: consignee.username,
                content: path,
                options: options
            }
            //distribute the image to all sockets of the client
            connectedUsers[socket.handshake.session.passport.user].sockets.forEach(function (sid) {
                io.sockets.connected[sid].emit('drawn', contentObj);
            });

            //distribute the image to all of the sockets of the partner
            if (connectedUsers[consignee.id])
                connectedUsers[consignee.id].sockets.forEach(function (sid) {
                    io.sockets.connected[sid].emit('drawn', contentObj);
                });
        });

        //whenever a user leaves remove the corresponding socket from the connectedusers array
        socket.on('disconnect', function () {
            connectedUsers[socket.handshake.session.passport.user].sockets.splice(connectedUsers[socket.handshake.session.passport.user].sockets.indexOf(socket.id), 1);
            if (connectedUsers[socket.handshake.session.passport.user].sockets.length == 0)
                delete connectedUsers[socket.handshake.session.passport.user];
            console.log('user disconnected');
        });

        //search engine
        socket.on('search', function (entry) {
            User.find({ 'username': { '$regex': entry } }, function (err, result) {
                if (err)
                    throw err;
                else {
                    var array = [];
                    result.forEach(function (element) {
                        array.push(element.username);
                    });
                    socket.emit('searchResults', array);
                }
            });
        });
        //handle request finalization
        socket.on('request-accept', function (username) {
            //get the id of the user
            dbQuery(User, { username: username }).then(function (result) {
                //get both the pending and the new requests from the friendslist collection with the newly obtained id and set their status fields to 'finished'
                 Relations.update({ userID: socket.handshake.session.user._id, friendID: result[0]._id }, { $set: { status: 'finished' } }, function(err, res){ if(err) throw err; });
                 Relations.update({ userID: result[0]._id, friendID: socket.handshake.session.user._id }, { $set: { status: 'finished' } }, function(err, res){ if(err) throw err; });
                 socket.emit('request-accepted', username);
            }, function (err) { throw err; });
        });

        //handle friend requests
        socket.on('add-user', function (username) {
            //get the ide of the user
            dbQuery(User, { username: username }).then(function (result) {
                Relations.create({
                    userID: socket.handshake.session.user._id,
                    friendID: result[0]._id,
                    status: 'pending'
                }, function (err, instance) { if (err) { throw err; } });

                Relations.create({
                    userID: result[0]._id,
                    friendID: socket.handshake.session.user._id,
                    status: 'new-request'
                }, function (err, instance) { if (err) { throw err; } });

            }, function (err) { throw err; });
        });
    });
}