function drawingBoard(canvas, toolPicker, colorScale, brushPicker, socket){
  this.cx = canvas.getContext("2d");
  this.socket = socket;
  this.toolPicker = toolPicker;
  this.colorScale = colorScale;
  this.brushPicker = brushPicker;
  this.lastClick = -1;

   //set width and height here
  this.cx.canvas.width = $(this.cx.canvas.parentNode).width();
  this.cx.canvas.height = $(this.cx.canvas.parentNode).height();

  this.pathObject = {
      start: {x: null, y: null},
      end: { x: null, y: null },
      type: null
  };

  this.options = {
    fillStyle: "#000000",
    lineCap: "butt",
    lineWidth: 1,
    strokeStyle: "#000000",
    globalCompositeOperation: "source-over"
  };

  this.activeTool = this.line;

  var self = this;
  this.wrapper = function(event){
    self.activeTool(event);
  }

  this.applyTool = function(){
    this.cx.canvas.addEventListener("mousedown", self.wrapper);
  }
  this.applyTool();

  this.handleColorChange();
  this.handleBrushSizeChange();
  this.handleToolChange();

    //resize the canvas whenever the 'zoom' event occures
    /*
    $($('#frame')[0].contentWindow).resize(function () { $(window).trigger('zoom'); });
    $(window).on('zoom', function () {
        console.log('eee');
        var inMemCanvas = document.createElement('canvas');
        var inMemCtx = inMemCanvas.getContext('2d');
        inMemCtx.drawImage(self.cx.canvas, 0, 0);

        self.cx.canvas.width = $(self.cx.canvas.parentNode).width();
        self.cx.canvas.height = $(self.cx.canvas.parentNode).height();
        self.cx.drawImage(inMemCanvas, 0, 0);
    });
    */
}

//HANDLERS
drawingBoard.prototype.updateCxProperties = function (opObj) {
    if (arguments.length)
        for (prop in opObj) 
            this.cx[prop] = opObj[prop]; 
    else
      for(prop in this.options)
        this.cx[prop] = this.options[prop];
      
}

drawingBoard.prototype.handleColorChange = function(){
  var self = this;
  this.colorScale.addEventListener("change", function(event){
    self.options.fillStyle = "#" + event.target.value;
    self.options.strokeStyle = "#" + event.target.value;
    self.updateCxProperties();
  });
}

drawingBoard.prototype.handleBrushSizeChange = function(){
  var self = this;
  this.brushPicker.addEventListener("change", function(event){
    self.options.lineWidth = event.target.value;
    self.updateCxProperties();
  });
}

drawingBoard.prototype.handleToolChange = function(){
  var that = this;
  this.toolPicker.addEventListener("change", function(event){
    if(that.__proto__.hasOwnProperty(event.target.value)){
      that.lastClick = -1;
      that.cx.canvas.removeEventListener("mousedown", that.wrapper);
      that.activeTool = that.__proto__[event.target.value];
      that.applyTool();
    }
  });
}

//TOOLS

drawingBoard.prototype.line = function (event, onEnd){
  this.options.lineCap = "round";
  this.updateCxProperties();

  var cx = this.cx;
  var pos = relativePos(event, this.cx.canvas);
  var that = this;
  trackDrag(function (event) {
    //set the path object's start coordinates
    that.pathObject.type = "line";
    that.pathObject.start.x = pos.x;
    that.pathObject.start.y = pos.y;

    cx.beginPath();
    cx.moveTo(pos.x, pos.y);
    pos = relativePos(event, cx.canvas);
    //set the path object's end coordinates
    that.pathObject.end.x = pos.x;
    that.pathObject.end.y = pos.y;

    cx.lineTo(pos.x, pos.y);
    cx.stroke();
    //share the path object with the server 
    that.socket.emit('emit_draw', that.pathObject, that.options);
  }, onEnd, this.cx.canvas);
}

drawingBoard.prototype.straightLine = function(event){
  this.options.lineCap = "round";
  this.updateCxProperties();

  if (this.lastClick != -1) {
    //set the path object's start coordinates
    this.pathObject.type = "straightLine";
    this.pathObject.start.x = this.lastClick.x;
    this.pathObject.start.y = this.lastClick.y;

    this.cx.beginPath();
    this.cx.moveTo(this.lastClick.x, this.lastClick.y);
    var pos = relativePos(event, this.cx.canvas);

    //set the path object's end coordinates
    this.pathObject.end.x = pos.x;
    this.pathObject.end.y = pos.y;

    this.cx.lineTo(pos.x, pos.y);
    this.cx.stroke();
    this.socket.emit('emit_draw', this.pathObject, this.options);
    this.lastClick = -1;
  }
  else {
    var pos = relativePos(event, this.cx.canvas);
    this.lastClick = pos;
  }
}

drawingBoard.prototype.eraser = function(event){
    this.options.globalCompositeOperation = "destination-out";
    this.updateCxProperties();

    var self = this;
    this.line(event, function(){
      self.options.globalCompositeOperation = "source-over";
      self.updateCxProperties();
    })
}

drawingBoard.prototype.spray = function(event) {
  var radius = this.options.lineWidth / 2;
  var area = radius * radius * Math.PI;
  var dotsPerTick = Math.ceil(area / 30);

  var pos = relativePos(event, this.cx.canvas);
  var self = this;
  var spray = setInterval(function() {
      for (var i = 0; i < dotsPerTick; i++) {
        var offset = randomPointInRadius(radius);
        //set up the path object
        self.pathObject.type = "spray";
        self.pathObject.start.x = pos.x;
        self.pathObject.start.y = pos.y;
        self.pathObject.end.x = offset.x;
        self.pathObject.end.y = offset.y;

        self.cx.fillRect(pos.x + offset.x, pos.y + offset.y, 1, 1);
        //emit the path& options objects to the server
        self.socket.emit('emit_draw', self.pathObject, self.options);
      }
  }, 25);

  trackDrag(function(event) {
    pos = relativePos(event, self.cx.canvas);
  }, function() {
    clearInterval(spray);
  }, this.cx.canvas);
}

function randomPointInRadius(radius) {
  for (;;) {
    var x = Math.random() * 2 - 1;
    var y = Math.random() * 2 - 1;
    if (x * x + y * y <= 1)
      return {x: x * radius, y: y * radius};
  }
}

function trackDrag(onMove, onEnd, node) {
  function end(event) {
    node.removeEventListener("mousemove", onMove);
    node.removeEventListener("mouseup", end);
    if (onEnd)
      onEnd(event);
  }
  node.addEventListener("mousemove", onMove);
  node.addEventListener("mouseup", end);
}

function relativePos(event, element) {
  var rect = element.getBoundingClientRect();
  return {x: Math.floor(event.clientX - rect.left),
          y: Math.floor(event.clientY - rect.top)};
}
