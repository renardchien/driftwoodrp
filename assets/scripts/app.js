/**
 * Sets environment variable, whether or not
 * this is a DEV environment 
 * @type {Boolean}
 */
var DEV = false;

$(document).ready(function() { 
  var $document = $(document),
      $window = $(window),
      $body = $('body');


  /**
   * Core engine. Creates instances of all our sub controllers
   * and listens for major events to pass along to the correct
   * controller. 
   */
  Driftwood = Backbone.View.extend( {
    /**
     * Container of all our visibile
     * @type object
     */
    el: $('.main'),

    initialize: function() {        

      _.bindAll(this, 'render');

      this.addEventListeners();
      
    },

    run: function() {
      this.ContextMenu = new ContextMenu();
      this.Chat = new Chat();
      this.CanvasManager = new CanvasManager();
      this.Commands = new Commands({CanvasManager:this.CanvasManager});
    },

    addEventListeners: function() {
      //Tabs
      $body.on('click','[data-toggle="tab"]', function() {
        var $this = $(this);
        $body.find($this.closest('[data-tab-panels]').data('tab-panels')).hide();
        $body.find($(this).data('target')).css('display','table-row');
      } );

      //Elastic input
      var scope = this;
      
      //Makes textareas elastic
      $body.find('[data-activate="elastic"]').each( function() {
        scope.dataActivate([this]);
      } );
      //Runs activation toggles
      $body.on('click focus blur','[data-activate]:not([data-on="load"])', function(e) {
        var on = $(this).data('on');
        if( ! on || on.split(',').indexOf(e.type) !== -1 ) {
          scope.dataActivate(this);
        }
      } );
      //Clears a target of its value
      $body.on('click','[data-clear]', function() {
        var $target = $body.find($(this).data('clear'));
        $target.val('');
      })

      //Creates a color picker
      $editorPicker = $body.find('.editor-color')
      $editorPicker.ColorPicker({
        onSubmit: function(hsb, hex, rgb, el) {
          $editorPicker.val('#' + hex);
          $body.find('.editor').css('background-color', '#' + hex);
        },
        onBeforeShow: function () {
          $(this).ColorPickerSetColor(this.value);
        },
        onChange: function (hsb, hex, rgb) {
          $editorPicker.val('#' + hex);
          $editorPicker.trigger('change');
          $body.find('.editor').css('background-color', '#' + hex);
        }
      });

    },

    dataActivate: function( object ) {
      var $object = $(object),
          activate = $object.data('activate'),
          target = $object.data('target'),
          $target = $body.find(target),
          $value = $object.attr('value') ? $object.attr('value') : $object.html();

      switch( activate ) {
        case 'elastic':
          this.elasticize(object);
          break;
        case 'focus':
          $target.toggleClass('focus');
          break;
        case 'replace':
          $target.html($value);
          break;
      }
    },

    //Makes a textarea elastic
    elasticize: function(a) {
      var b="overflow"+("overflowY" in document.getElementsByTagName("script")[0].style?"Y":""),e=function(h,g,j){if(g.addEventListener){for(var f=0;f<h.length;f++){g.addEventListener(h[f],j,0)}}else{if(g.attachEvent){for(var f=0;f<h.length;f++){g.attachEvent("on"+h[f],j)}}}};for(var c=0;c<a.length;c++){a[c].style[b]="hidden";a[c].__originalRows=a[c].rows;var d=function(f){var h=f.target||f.srcElement||this,g=h.scrollTop;h.scrollTop=1;while(h.scrollTop>0){var j=h.clientHeight,i=true;h.rows++;if(h.clientHeight==j){if(h.style[b]){h.style[b]=""}h.scrollTop=g;return}h.scrollTop=1}if(!i){while(h.scrollTop==0&&h.rows>h.__originalRows){h.rows--;h.scrollTop=1}if(h.scrollTop>0){h.rows++}}if(!h.style[b]){h.style[b]="hidden"}};e(["keyup","paste"],a[c],d);d({target:a[c]})}
    },
 
  } );

  /**
   * Context Menu View
   *
   * Allows us to open our own context menu where ever we want. When 
   * a context menu is opened, an X and Y position must be passed.
   *
   * In order to filter out what menu options are available, 
   */
  ContextMenu = Backbone.View.extend( {
    // Container element
    el: $('body'),
    //Grab the template from the page
    template: _.template($('#contextMenuTemplate').html()),

    initialize: function() {
      _.bindAll(this,'render');
      //Add event listeners
      this.addEventListeners();
    },
    addEventListeners: function() {
      //Creates a context menu
      $body.on('contextmenu','.canvas-wrapper', _.bind( function(e) {
        this.open( {
          x:e.clientX,
          y:e.clientY,
          e: e
        } );
        e.preventDefault();
      }, this ) );
      //Makes sure the context menu gets closed
      $body.on('click', _.bind(this.close,this));
    },
    open: function(options) {
      //Set all our options
      this.options = options;
      this.object = options.object || false;
      this.X = options.x;
      this.Y = options.y;

      //Build the menu, close other menus, render a new one
      this.buildContextMenu();
      this.close();
      this.render();
    },
    buildContextMenu: function() {
      //TODO: Determine what options should be turned on or off
    },
    render: function() {
      $(this.el).append(this.template({}));
      $body.find('.context-menu').css( {
        top: this.Y,
        left: this.X
      } );
    },
    close: function() {
      $body.find('.context-menu').remove();
    }
  } );

  /**
   * Chat
   *
   * Allows us to send, receive, and render chat
   * messages. 
   */
  Chat = Backbone.View.extend( {
    // Container element
    el: $('.panel .chat'),
    //Grab the template from the page
    template: _.template($('#chatMessageTemplate').html()),

    initialize: function() {
      _.bindAll(this,'render');
      //Add event listeners
      this.addEventListeners();
      this.scrollChat(0);
    },
    addEventListeners: function() {
      //Chat enter
      $(this.el).on('keypress','.input textarea', _.bind( function(e) {
        //Enter key, but not shift enter
        if( e.keyCode === 13 && ! e.shiftKey ){
          this.sendMessage(e.target);
          return false;
        }
      }, this ) );
    },

    sendMessage: function(input) {
      var $input = $(input),
          message = $input.val();

      $input.val('')
      //TODO: Send message off to server
      if( message.replace(/\s+/g, ' ') !== '' ) {
        console.log(message);
        this.message = message;
        this.render();

        //Remove the active class after rendered
        $(this.el).find('.messages .active').removeClass('active');
      }
        
    },

    render: function() {
      var $messages = $(this.el).find('.messages'),
          scrollTop = $messages[0].scrollTop,
          scrollHeight = $messages[0].scrollHeight,
          height = $messages.outerHeight();

      $messages.append(this.template({message: this.message}));

      //Were they at the bottom when we added the message?
      //If so, scroll. If not, don't ruin their scroll position
      if( (scrollHeight - scrollTop) == height  ) {
        this.scrollChat(100);
      }
    },

    //Scrolls the chat window
    scrollChat: function( scrollTime ) {
      var scrollTime = (typeof scrollTime === 'undefined') ? 500 : scrollTime,
          $messages = $body.find('.messages'),
          scrollHeight = $messages[0].scrollHeight;
    
      $messages.scrollTo(scrollHeight,scrollTime);
    },
  } );

  /**
   * Command
   *
   * Handles the command menu, activating the correct buttons, sub menus.
   * Also listens for commands from the user and passes them along to
   * the correct place.
   *
   * FIXME: Certain commands like switching the map layer should
   * activate whatever command was previously being used. ie, if I
   * was drawing a circle, I switch layers, it should go back to 
   * drawing a circle.
   */
  Commands = Backbone.View.extend( {
    // Container element
    el: $('.editor .commands'),

    subMenuDelay: 700,

    _lastCmd: false,

    initialize: function(options) {
      _.bindAll(this,'render');
      //Set options
      this.options = options;
      this.CanvasManager = options.CanvasManager || new CanvasManager();
      //Add event listeners
      this.addEventListeners();
      //Execute intiial loading command
      this.runInitialCommand();
    },
    addEventListeners: function() {
      var scope = this;
      //Switches the active icon when a dropdown option is selected
      $body.on('click','.commands .dropdown-menu li', function() {
        var $this = $(this),
            icon = $this.find('b').attr('class'),
            command = $this.closest('[data-cmd]').data('cmd'),
            value = $this.closest('[data-cmd]').data('cmd-value'),
            $parentIcon = $this.closest('.command').find('.menu-btn b');

        //Switches the main button icon/command/command value
        $parentIcon.attr('class',icon);
        $parentIcon.closest('[data-cmd]').attr('data-cmd',command);
        $parentIcon.closest('[data-cmd]').attr('data-cmd-value',value);
        $body.find('.commands .menu-btn.active').removeClass('active');
        $parentIcon.parent().addClass('active');
        $body.find('.command.open').removeClass('open');
      } );


      //Hook into mousedown to fire off our long press test. Sets a timer to
      //show the dropdown menu in X seconds
      $body.on('mousedown','.commands .menu-btn', function(e) {
        console.log($(this));
        var $this = $(this);
        $this.button('toggle');
        //Close all the open submenus
        $body.find('.command.open').removeClass('open');
        //After XX seconds, open the menu
        scope.commandTimer = window.setTimeout(function () {
          $this.closest('.command').addClass('open');
        }, scope.subMenuDelay );
        e.preventDefault();
      } );

      //Clears the longpress timer
      $body.on('mouseup','.commands .menu-btn', function(e) {
        clearTimeout(scope.commandTimer);
      } );
      //Simple do command event listener
      $body.on('click','[data-cmd]', function(e) {
        //Don't execute the command if the sub menu is open
        if( $(this).closest('.command').hasClass('open') ) {
          return false;
        }
        scope.commandClicked(this);
      } );
    },
    //Checks the DOM to see what command is set as active and runs it
    runInitialCommand: function() {
      $body.find('.commands [data-cmd].active').trigger('click');
    },
    commandClicked: function(object) {
      var $this = $(object);
            command = $this.attr('data-cmd'),
            value = $this.attr('data-cmd-value');

      this.doCommand(command,value);
    },
    /**
     * Checks our command switch and fires off the command to whatever
     * controller needs it. 
     *
     * FIXME: instead of checking the commands here, this should fire
     * off an event. The engine controller should be listening for
     * command events and do the routing to the correct subcontroller
     * (decouples this view from everything else. right now it's dependant
     * on driftwood.engine.CanvasManager)
     */
    //controller neds it
    doCommand: function(command,value) {
      console.log('Command:',command,value);

      switch(command) {
        case 'moveCanvas' :
          driftwood.engine.CanvasManager.trigger('moveCanvas',value);
          break;
        case 'selectCanvas' :
          driftwood.engine.CanvasManager.trigger('selectCanvas',value);
          break;
        case 'draw' :
          driftwood.engine.CanvasManager.trigger('draw',value);
          break;
        case 'switchLayer' :
          driftwood.engine.CanvasManager.trigger('switchLayer',value);
          break;
        case 'zoomIn':
          driftwood.engine.CanvasManager.trigger('zoomIn');
          break;
        case 'zoomOut':
          driftwood.engine.CanvasManager.trigger('zoomOut');
          break;
      }
      //Command is not switch layer, so save the last command
      if( command !== 'switchLayer' ) {
        this._lastCmd = {command:command,value:value};
      //Command IS switch layer, and they were doing something
      //previous so reactivate that command
      } else if ( this._lastCmd && ['zoomIn','zoomOut'].indexOf(this._lastCmd.command) === -1 ) {
        //FIXME: Make the button actove
        $body.find('.menu-btn[data-cmd="'+this._lastCmd.command+'"]').trigger('click');
      }
    },
  } );

  /**
   * CanvasManager
   *
   * Handles interaction with the canvas. Creating objects, moving them,
   * moving the canvas, etc.
   *
   * FIXME: Some of the utility objects are created in a really funky way
   * (you have to pass context and other weird things)
   * 
   */
  CanvasManager = Backbone.View.extend( {
    
    canvasMove: false,

    initialLayer: 'map_layer',

    CANVAS_WIDTH: 3000,

    CANVAS_HEIGHT: 3000,

    layers: [
      {
        layer_name: 'map_layer'
      },
      {
        layer_name: 'grid_layer'
      },
      {
        layer_name: 'object_layer'
      },
      {
        layer_name: 'gm_layer'
      },
    ],

    initialize: function() {
      _.bindAll(this,'render');
      
      //Store reference to our canvas object
      this.canvas = new fabric.Canvas('c');
      //Sset our intial canvas width
      this.canvas.setWidth( this.CANVAS_WIDTH );
      this.canvas.setHeight( this.CANVAS_HEIGHT );

      //Just for now
      //FIXME: The grid should actually be on its own layer
      this.canvas.setOverlayImage('assets/images/grid.svg', this.canvas.renderAll.bind(this.canvas))

      //Create our drawing utility
      this.drawing = this.drawingUtil.init(this);
      //Zoom utility
      this.zoom = this.zoomUtil.init(this);

      //Add event listeners
      this.addEventListeners();
      
      //Make sure we'll all sized up
      this.on_resize();

      //Set initial layer
      this.switchLayer(this.initialLayer);
    },

    addEventListeners: function() {
      //Backbone View event listeners
      this.on('moveCanvas selectCanvas draw switchLayer', _.bind(this.disableAll,this));
      this.on('moveCanvas', _.bind(this.activateCanvasMove,this));
      this.on('selectCanvas',_.bind(this.activateCanvasSelect,this));
      this.on('draw',_.bind(this.draw,this));
      this.on('switchLayer',_.bind(this.switchLayer,this));
      this.on('zoomIn',this.zoom.In);
      this.on('zoomOut',this.zoom.Out);

      //Window listener
      $window.on('resize',this.on_resize);

      //Canvas events
      //FIXME: Move this code out into it's own function? Create
      //a Backbone Model for an object?
      this.canvas.on('object:added', _.bind( function(e) {
        var activeObject = e.target,
            currentLayer = this.currentLayer;
        if( ! activeObject.toJSON().layer ) {
          activeObject.toObject = (function(toObject) {
            return function() {
              return fabric.util.object.extend(toObject.call(this), {
                layer: currentLayer,
              });
            };
          })(activeObject.toObject);
        }
        //Move the object to the front of it's layer
        this.sendToFront(activeObject);
      }, this ) );
      
    },

    /**
     * Since we work with different layers, we can't just sent to front of all objects.
     * We have to send to front of that layer. 
     */
    sendToFront: function(obj) {
      //Get the current layer name and index of this object
      var _objects = this.canvas.getObjects(),
          _index = _objects.indexOf(obj),
          layer = obj.toJSON().layer;

      //Get the index of the front most object in the
      //same layer. 
      var index = this.getFrontLayerIndex(layer);
      //If the indexes do not match, this object is not 
      //at the front of its layer
      if( _index !== index ) {
        this.canvas.moveTo(obj,index);
      }
    },

    /**
     * Finds the highest index for a given layer. Starts at the bottom
     * and works it's way forward until it finds an object that is suppose
     * to be a layer above it. It will then be moved to that index.
     *
     * If no layer above it is found, then it should be the top most
     * object.
     * 
     * @access public
     * @param  string layer Name of layer
     * @return integer
     */
    getFrontLayerIndex: function(layer) {
      var _objects = this.canvas.getObjects(),
          _layerIndex = this.getLayerIndex(layer)
          _index = 0; //Starting index

      for( var i = 0; i < _objects.length; i++ ) {
        //Get this objects layer index
        var layerIndex = this.getLayerIndex(_objects[i].toJSON().layer);
        _index = i; //Our new index
        //If layer index of this object is greater than the layer we're
        //looking for, we have found our top most index. Break out of loop
        if( layerIndex > _layerIndex ) {
          break;
        }
      }
      return _index;
    },

    /**
     * Given a layer string, figures out what index the layer is at.
     */
    getLayerIndex: function(layer) {
      var layerIndex;
      //Go through the layers until we find a matching name.
      //FIXME: Is there better way to do this? 
      _.each( this.layers, function(layerObj,index) {
        if( layerObj.layer_name == layer ) {
          layerIndex = index;
        }
      } );
      return layerIndex;
    },

    //Make sure the canvas wrapper stays the width of the screen, minus our side panel
    on_resize: function() {
      $body.find('.canvas-wrapper').width($window.width()-$('.panel').outerWidth()).height($window.height());
    },

    //Disables all our different canvas interactions
    disableAll: function() {
      this.disableCanvasMove();
      this.drawing.circle.stopDrawing();
      this.drawing.rectangle.stopDrawing();
      this.canvas.isDrawingMode = false;
      this.canvas.selection = true;
    },

    //Draw something
    draw: function(what) {
      switch(what) {
        case 'free':
          this.canvas.isDrawingMode = true;
          break;
        case 'circle':
          this.drawing.circle.startDrawing();
          break;
        case 'rectangle':
          this.drawing.rectangle.startDrawing();
      }
      
    },

    /**
     * Switches the currently active layer. Goes through all the
     * objects on the canvas and disabled anything that isn't this
     * layer and makes sure anything that IS on this layer is enabled
     */
    switchLayer: function(layer) {
      this.currentLayer = layer;
      //Grab objects
      var _objects = this.canvas.getObjects();
      //Go through each object and add it to the correct canvas
      _objects.forEach( _.bind( function(object) {
        //Not on this later, move to the tmp canvas
        if( object.toJSON().layer !== this.currentLayer ) {
          object.selectable = false;
          object.set('opacity',0.5)
        //Is the current layer, so let's interact with it
        } else {
          object.selectable = true;
          object.set('opacity',1);
        }
      }, this ) );
      
      //Make sure everything is rendered
      this.canvas.deactivateAll().renderAll();
    },

    //Allows items on the canvas to be selected
    activateCanvasSelect: function() {
      this.canvas.selection = true;
    },

    /**
     * Canvas Move
     *
     * These functions handle moving the canvas. One function to activate,
     * one to deactivate, what to start the move, one to stop the move, and another
     * to actually move
     *
     * The moving actually takes place on the editor overlay, and we just
     * adjust the scroll height/width to make it look like we are panning
     */
    //Says we can move a canvas, declares event listeners
    activateCanvasMove: function() {
      $body.find('.editor .overlay').show();
      $body.on('mousedown.canvasPan','.canvas-wrapper', _.bind( this.startCanvasMove, this ) );
      $body.on('mouseup.canvasPan', _.bind( this.stopCanvasMove, this ) );
      $body.on('mousemove.canvasPan','.canvas-wrapper', _.bind( this.moveCanvas, this ) );
    },
    //Removes event listeners for the canvas move
    disableCanvasMove: function() {
      $body.off('.canvasPan');
      $body.find('.editor .overlay').hide();
    },
    
    startCanvasMove: function(e) {
      this.canvasMove = true;
      this.X = e.clientX;
      this.Y = e.clientY;
      this.scrollLeft = $body.find('.canvas-wrapper')[0].scrollLeft;
      this.scrollTop = $body.find('.canvas-wrapper')[0].scrollTop;
    },

    stopCanvasMove: function() {
      $body.find('.overlay').css({
        top: 0,
        left: 0
      } );
      this.canvasMove = false;
    },
    moveCanvas: function(e) {
      if( this.canvasMove ) {
        var moveY = e.clientY - this.Y,
            moveX = e.clientX - this.X;

        $body.find('.editor .overlay').css({
          top: moveY,
          left: moveX
        } );
        if( this.scrollLeft - moveX > 0 ) {
          $body.find('.canvas-wrapper').scrollLeft( this.scrollLeft + (- moveX) );
        }
        if( this.scrollTop - moveY > 0 ) {
          $body.find('.canvas-wrapper').scrollTop( this.scrollTop + (- moveY) ) ;
        }
      }
      e.preventDefault();
    },
    
    /**
     * Utility for zooming the canvas. At the moment it provides a way to 
     * zoom in and zoom out. 
     *
     * FIXME: Activate zoom in/out and when they click on the canvas it should
     * zoom in and out based on the origin click (which means we need to both 
     * zoom in/out and scroll to the correct location). At the moment they
     * have to click on the menu icons to zoom in and out.
     * 
     * @type {Object}
     */
    zoomUtil: {
      //Init function. Needs context to our global object
      init: function(context) {
        canvas = context.canvas;
        SCALE_FACTOR = 1.2;
        canvasScale = 1;
        return {
          In: function(event) {
            // TODO limit the max canvas zoom in
            canvasScale: canvasScale * SCALE_FACTOR,
            
            canvas.setHeight(canvas.getHeight() * SCALE_FACTOR);
            canvas.setWidth(canvas.getWidth() * SCALE_FACTOR);
            
            var objects = canvas.getObjects();
            for (var i in objects) {
                var scaleX = objects[i].scaleX;
                var scaleY = objects[i].scaleY;
                var left = objects[i].left;
                var top = objects[i].top;
                
                var tempScaleX = scaleX * SCALE_FACTOR;
                var tempScaleY = scaleY * SCALE_FACTOR;
                var tempLeft = left * SCALE_FACTOR;
                var tempTop = top * SCALE_FACTOR;
                
                objects[i].scaleX = tempScaleX;
                objects[i].scaleY = tempScaleY;
                objects[i].left = tempLeft;
                objects[i].top = tempTop;
                
                objects[i].setCoords();
            }
                
            canvas.renderAll();
          },
          Out: function() {
            console.log('zoom out');
            // TODO limit max cavas zoom out
            canvasScale = canvasScale / SCALE_FACTOR;
            
            canvas.setHeight(canvas.getHeight() * (1 / SCALE_FACTOR));
            canvas.setWidth(canvas.getWidth() * (1 / SCALE_FACTOR));
            
            var objects = canvas.getObjects();
            for (var i in objects) {
                var scaleX = objects[i].scaleX;
                var scaleY = objects[i].scaleY;
                var left = objects[i].left;
                var top = objects[i].top;
            
                var tempScaleX = scaleX * (1 / SCALE_FACTOR);
                var tempScaleY = scaleY * (1 / SCALE_FACTOR);
                var tempLeft = left * (1 / SCALE_FACTOR);
                var tempTop = top * (1 / SCALE_FACTOR);

                objects[i].scaleX = tempScaleX;
                objects[i].scaleY = tempScaleY;
                objects[i].left = tempLeft;
                objects[i].top = tempTop;

                objects[i].setCoords();
            }
            
            canvas.renderAll();
          }
        };
      },
        
    },
    /**
     * Allows us to draw different things. Has a utility for free drawing
     * a circle and a rectangle.
     */
    drawingUtil: {
      //Init function. Needs context to our global object
      init: function(context) {
        this.canvas = context.canvas;
        this.circle = this.circleUtil(this.canvas);
        this.rectangle = this.rectangleUtil(this.canvas);
        return this;
      },
      /**
       * Draw Circle
       *
       * These functions help draw a circle. Like always, one to activate/deactivate/
       * start/stop/draw
       */
      circleUtil: function(canvas) {
        return {
          canvas: canvas,

          color: 'red',

          //Sets variables and adds events to the mouse
          startDrawing: function(canvas) {
            this.canvas.selection = false;
            _.bindAll(this,'startCircleDraw','stopCircleDraw','drawCircle');   
            this.canvas.on('mouse:down', this.startCircleDraw);
            this.canvas.on('mouse:up', this.stopCircleDraw);
            this.canvas.on('mouse:move', this.drawCircle);

          },
          //Disable drawing
          stopDrawing: function() {
            this.canvas.off('mouse:down', this.startCircleDraw);
            this.canvas.off('mouse:up', this.stopCircleDraw);
            this.canvas.off('mouse:move', this.drawCircle);
          },
          //Set our intial circle. We're actually creating an Ellipse
          //with some intial qualities and then making it bigger
          startCircleDraw: function(event) {
            //Where did the mouse click start
            this.startX = event.e.x;
            this.startY = event.e.y;
            //Don't start if this is already an object
            if( ! event.target ){
              //Create our "circle"
              var object = new fabric.Ellipse({
                left:   event.e.x,
                top:    event.e.y,
                originX: 'left',
                originY: 'top',
                rx: 0,
                ry: 0,
                selectable: false,
                stroke: this.color,
                strokeWidth: 2,
                fill: this.color
              });

              //Add it to the canvas
              this.canvas.add(object);
              this.circle = object;
            }
          },
          //Stops drawing the circle (they let up on the mouse)
          stopCircleDraw: function(event) {
            if( this.circle ){
              // Remove object if mouse didn't move anywhere
              if(event.e.x == this.startX && event.e.y == this.startY ){
                this.canvas.remove(this.circle);
              }
              
              this.circle.selectable = true;
              this.circle.setCoords();
              this.circle = null;
            }
          },
          //Technically the circle is already drawn. Here we are just
          //making it bigger
          drawCircle: function(event) {
            if( this.circle ){
              // Resize object as mouse moves
              var width = (event.e.x - this.startX),
                  height = (event.e.y - this.startY),
                  originX = width > 0 ? 'left' : 'right',
                  originY = height > 0 ? 'top' : 'bottom';

              this.circle.set({
                rx: Math.abs(width)/2,
                ry: height/2,
                originX: originX,
                originY: originY,
                width: Math.abs(width), //Always positive
                height: Math.abs(height) //Always positive
              }).adjustPosition(originX); //Set our origin point
              //Render everything
              this.canvas.renderAll();
            }
          },
        }//END return
      },//END Circle UTIL
      /**
       * Draw Rectangle
       *
       * These functions help draw a rectangle. Like always, one to activate/deactivate/
       * start/stop/draw
       */
      rectangleUtil: function(canvas) {
        return {
          canvas: canvas,

          color: 'green',

          //Sets variables and adds events to the mouse
          startDrawing: function(canvas) {
            this.canvas.selection = false;
            _.bindAll(this,'startRectangleDraw','stopRectangleDraw','drawRectange');   
            this.canvas.on('mouse:down', this.startRectangleDraw);
            this.canvas.on('mouse:up', this.stopRectangleDraw);
            this.canvas.on('mouse:move', this.drawRectange);

          },
          //Disable drawing
          stopDrawing: function() {
            this.canvas.off('mouse:down', this.startRectangleDraw);
            this.canvas.off('mouse:up', this.stopRectangleDraw);
            this.canvas.off('mouse:move', this.drawRectange);
          },
          //Set our intial circle. We're actually creating an Ellipse
          //with some intial qualities and then making it bigger
          startRectangleDraw: function(event) {
            //Where did the mouse click start
            this.startX = event.e.x;
            this.startY = event.e.y;
            //Don't start if this is already an object
            if( ! event.target ){
              //Create our "circle"
              var object = new fabric.Rect({
                left:   event.e.x,
                top:    event.e.y,
                originX: 'left',
                originY: 'top',
                width: 0,
                height: 0,
                selectable: false,
                stroke: this.color,
                strokeWidth: 2,
                fill: 'green'
              });

              //Add it to the canvas
              this.canvas.add(object);
              //this.canvas.setActiveObject(object,event);
              this.rectangle = object;
            }
          },
          //Stops drawing the circle (they let up on the mouse)
          stopRectangleDraw: function(event) {
            if( this.rectangle ){
              // Remove object if mouse didn't move anywhere
              if(event.e.x == this.startX && event.e.y == this.startY ){
                this.canvas.remove(this.rectangle);
              }
              
              this.rectangle.selectable = true;
              this.rectangle.setCoords();
              this.rectangle = null;
            }
          },
          //Technically the circle is already drawn. Here we are just
          //making it bigger
          drawRectange: function(event) {
            if( this.rectangle ){
              // Resize object as mouse moves
              var width = (event.e.x - this.startX),
                  height = (event.e.y - this.startY),
                  originX = width > 0 ? 'left' : 'right',
                  originY = height > 0 ? 'top' : 'bottom';

              this.rectangle.set({
                originX: originX,
                originY: originY,
                width: Math.abs(width), //Always positive
                height: Math.abs(height) //Always positive
              }).adjustPosition(originX); //Set our origin point
              //Render everything
              this.canvas.renderAll();
            }
          },
        }//END return
      }//END Circle UTIL
    },//ND Drawing UTIL

  } );

  var driftwood = {
    engine: new Driftwood()
  }
  driftwood.engine.run();
});