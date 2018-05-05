$(document).ready(function () {
    //variable declaration here
    var socket = io();
    var acitvePartner = null;
    var username = null;
    var friends = [];
    var lastSearchResults = null;
    var board = new drawingBoard(document.getElementsByClassName('drawingboard')[0],
                                 document.getElementsByClassName('tools')[0],
                                 document.getElementsByClassName('jscolor')[0],
                                 document.getElementsByClassName('brushSize')[0], socket);

    //set the username and also construct the user's friendslist
    socket.on('personalData', function (data) {
       //console.log(data);
        username = data.username;
        //construct the friendsList
        data.friendslist.forEach(function (entry) {
            var friend = document.createElement('li');
            friend.className = 'friend';       
            friends.push(Object.keys(entry)[0]);
            //if the request isn't finished then toggle the appropriate class to indicate the state
            if (entry[Object.keys(entry)[0]] != 'finished')
                $(friend).addClass(entry[Object.keys(entry)[0]]);

            $('.friends-list').append($(friend).text(Object.keys(entry)[0]));
        });
        
        //register the event handler here on the 'friend'-type elements
        $('.friend').click(function () {
            //if the friend is already in a finished status then load the message history
            if (!$(this).hasClass('pending-friend') && !$(this).hasClass('new-request')) {
                //clear the msg-container
                var container = document.getElementsByClassName('messages-list')[0];
                while (container.firstChild)
                    container.removeChild(container.firstChild);

                //emit partner change event
                acitvePartner = $(this).text();
                socket.emit('partner change', acitvePartner);
            }
            else if($(this).hasClass('new-request')){
                //finalize the request
                socket.emit('request-accept', $(this).text());
            }
        });
    });

    $('.msgForm').submit(function () {
        if (acitvePartner) 
            socket.emit('chat message', $('.msg-input').val());
        $('.msg-input').val('');
        return false;
    });

    socket.on('chat message', function (msgObj) {
        //check whether the sender is the client and the consignee is the active partner or the other way around
        if ((msgObj.from == username && msgObj.to == acitvePartner) || (msgObj.from == acitvePartner && msgObj.to == username))
            $('.messages-list').append($('<li>').text(msgObj.from + ": " + msgObj.content));
    });

    socket.on('chat history', function (arrayOfMsg) {
        //append all the msgs from the msg history array to the container 
        arrayOfMsg.forEach(function (msg) {
            $('.messages-list').append($('<li>').text(msg));
        });
    });

    //handle incoming 'drawn' events from the server-side
    socket.on('drawn', function (imgObj) {
        //check whether the sender is the client and the consignee is the active partner or the other way around
        if ((imgObj.from == username && imgObj.to == acitvePartner) || (imgObj.from == acitvePartner && imgObj.to == username)) {
            var path = imgObj.content;
            board.updateCxProperties(imgObj.options);
            //check the tool type
            if (path.type == 'spray')
                board.cx.fillRect(path.start.x + path.end.x, path.start.y + path.end.y, 1, 1);
            else {
                board.cx.beginPath();
                board.cx.moveTo(path.start.x, path.start.y);
                board.cx.lineTo(path.end.x, path.end.y);
                board.cx.stroke();
            }
        }
    });

    //search handling
    $('.searchbar').on('keyup' ,function () {
        $('#users').focus();
        if ($(this).val())
            socket.emit('search', $(this).val());
    });

    //update the datalist as soon as the results came
    socket.on('searchResults', function (results) {
        //remove the current entries of the datalist
        var userList = document.getElementById('users');
        while (userList.firstChild) 
            userList.removeChild(userList.firstChild);
        
        //add the new entries
        results.forEach(function (element) {
            var option = document.createElement("option");
            option.value = element;
            option.className = 'search-result';
            userList.appendChild(option);
        });
        lastSearchResults = results;
    });

    //on friend request accepts
    socket.on('request-accepted', function (user) {
        var newReqs = document.getElementsByClassName('new-request');
        newReqs.forEach(function (req) {
            if ($(req).text === user) 
                $(req).removeClass('new-request');
        });
    });

    //send friend request
    $('.searchbar').change(function () {
        //if the selected entry isn't among the friends
        if (lastSearchResults.indexOf($(this).val() != -1) && friends.indexOf($(this).val()) == -1 && $(this).val() != username)
            socket.emit('add-user', $(this).val());
    });

    //this make it possible to log out from your account by attaching an event listener to the logout button
    $('.logout-button').click(function () { window.location = '/logout'; });
});
