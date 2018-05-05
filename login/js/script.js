function sendDataToServer(data){
  $.ajax({
    type: 'POST',
    data: JSON.stringify(data),
    contentType: 'application/json',
    url: 'http://localhost:8080/login/',
    success: function(data) {
      setTimeout(function(){ //fake loading
        if (typeof data.redirect == 'string')
            window.location = data.redirect;
          console.log('success');
      }, 4000);
    }
  });
}

function analyzeFormInput(form){
  var formData = new FormData(form);
  var result = {};
  var errorOccured = false;

  if($(form).hasClass("login-form"))
    result["type"] = "login";
  else
    result["type"] = "register";

  for (var entry of formData.entries()){
      if(entry[1].length != 0){
        result[entry[0]] = entry[1];
      }
      else{
        errorOccured = true;
        var attribute = "[name=" + entry[0] + "]";
        var field = form.querySelector(attribute);
        $(field).toggleClass("wrongField");
      }
  }

  if(errorOccured == true)
    return "error";
  else
    return result;
}

function handler(node, otherNode, form, arrayOfClasses, time){
  if($(node).hasClass(arrayOfClasses[0])){
    var result = analyzeFormInput(form);
    if(result != "error"){
      $(node).removeClass(arrayOfClasses[0]);
      form.style.opacity = 0;
      form.style.zIndex = -1;
      $(node).addClass(arrayOfClasses[1]);
      $(document.body).append('<img class="triangle-image" src="img/triangle.gif" width="240px">');
      setTimeout(function(){
        document.getElementsByClassName("triangle-image")[0].style.opacity = 1;
      }, 700);

      sendDataToServer(result);
    }
  }
  else {
    $(node).addClass(arrayOfClasses[0]);
    otherNode.style.visibility = "hidden";
    setTimeout(function(){
        form.style.opacity = 1;
        form.style.zIndex = 1;
    }, time);
  }
}

function loginHandler(event){
  event.preventDefault();
  var loginButton = document.getElementsByClassName("login-button")[0];
  var registerButton = document.getElementsByClassName("register-button")[0];
  var loginForm = document.getElementsByClassName("login-form")[0];
  var classes = ["upper-login", "lower-login"];
  handler(loginButton, registerButton, loginForm, classes, 500);
}

function registerHandler(event){
  event.preventDefault();
  var registerButton = document.getElementsByClassName("register-button")[0];
  var loginButton = document.getElementsByClassName("login-button")[0];
  var registerForm = document.getElementsByClassName("register-form")[0];
  var classes = ["lower-register", "upper-register"];
  handler(registerButton, loginButton, registerForm, classes, 1000);
}

function handleClicks(){
  document.getElementsByClassName("login-button")[0].addEventListener("click", loginHandler);
  document.getElementsByClassName("register-button")[0].addEventListener("click", registerHandler);
  document.getElementsByClassName("redo-button")[0].addEventListener("click", redo);
}
//to be finished...
function redo(){
  var regButton = document.getElementsByClassName("register-button")[0];
  $(regButton).removeClass("lower-register");
  document.getElementsByClassName("register-form")[0].style.opacity = 0;
  $(regButton).toggleClass("reset-register");
}
