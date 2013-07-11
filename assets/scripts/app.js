/**
 * Sets environment variable, whether or not
 * this is a DEV environment 
 * @type {Boolean}
 *
 *
 * BUG LIST
 *  - Object management
 *    - Delete
 *  - Zoom
 *    - Need fit to screen zoom
 *    - Zooming in twice makes the canvas disappear? This appears to be a memory problem with a big canvas.
 *  - Color pickers 
 *    - Are missing transparent or "none" option
 *    - Need to close color picker on mouse up or have some button to accept color
 *  - Selection
 *    - Selecting two or more items seems to move them to the top of the stack. This only
 *      seems to happen for the user selecting, not on other players screens. Possibly
 *      something to do with it being a group vs a single item
 *    - Dragging off canvas will do browser selection on other items (just get the browser blue selection)
 *  - Right clicking on a non selected object brings up a menu for the selected object. It should
 *    shift selection to that object and open a menu for that
 *  - When a player leaves, they maintain "control" over an object so others can't move it. Need to remove
 *    control when a player leaves (or add a "does this player exist" check when updating for player)
 *  
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
     * 
     * @type {Object}
     */
    el: $('.main'),

    /**
     * The current player
     * 
     * @type {Object}
     */
    player: false,

    /**
     * All the players that have joined
     * this game. Should be an object full
     * of objects, with the players ID as the
     * main key.
     * 
     * @type {Object}
     */
    players: false,

    /**
     * Default settings for the game. Initial game
     * settings can be sent in when initializing the
     * driftwood engine and will override these
     * defaults.
     * 
     * @type {Object}
     */
    default: {
      gamename: '',
      owner: false,
      liveUrl: '',
      canvas: false,
      canvasHeight: 3000,
      canvasWidth: 3000,
      enableFog: false,
      initialLayer: 'object_layer',
      editorColor: '#EAEAEA',
      grid: true,
      gridSize: 100,
      gridUnit: '5 ft',
      gridColor: '#777777',
      freeDrawColor: '#333333',
      freeDrawWidth: 1,
      freeDrawFill: '#ffffff',
      chatData: [],
      objects: [],
    },

    /**
     * Any options sent in are stored in this.options,
     * and then settings is set by merging default
     * and options. This way we always have access to
     * default options, the options they sent in, and
     * the current active settings
     */
    initialize: function(options) {
      //Set options
      this.options = options || {};
      this.settings = $.extend(this.default,this.options);
      //Bind everything
      _.bindAll(this, 'render');
      //Loading screen
      this.loading = new LoadingScreen();
      //Connect
      this.connect();
    },

    /**
     * Connect to the socket. At this point initial player settings should
     * already have been sent in as options to the driftwood engine. 
     * Any and all players joining will get adde to the master players object
     *
     *
     * TODO: Disconnect and session time out
     *
     * TODO: Error?
     */
    connect: function() {
      //liveUrl, gamename and owner are all defined dynamically in game2.jade (which is the html you wrote)
      this.socket = io.connect(this.settings.liveUrl); 

      //Connect socket, once that is complete join the game
      this.socket.on('connect', _.bind( function() {
        console.log('Joining game');
        this.socket.emit('join', { 'gameName': this.settings.gamename, 'owner': this.settings.owner });
      }, this ) );
      //This is for the current acting player
      //TODO: Need the server to send another socket event for
      //other players joining
      this.socket.on('joined', _.bind( function(data) {
        //What to do after successully joining a game
        console.log('Joined game successfully');
        //Create our current player
        console.log(data);
        this.player = new Player(data.user);
        if( data.chatSession ) {
          this.settings.chatData = data.chatSession;
        }
        if( data.objectLibrary.length ) {
          this.settings.objects = data.objectLibrary;
        }
        if( data.canvas ) {
          this.settings.canvas = data.canvas;
          canvasJSON = JSON.parse(data.canvas);
          this.settings.editorColor = canvasJSON.background;
          if( canvasJSON.objects.length && canvasJSON.objects[canvasJSON.objects.length -1].layer === 'grid_layer' ) {
            var grid = canvasJSON.objects[canvasJSON.objects.length -1];
            this.settings.grid = true;
            this.settings.gridColor = grid.stroke;
            this.settings.gridSize = grid.gridSize;
            this.settings.gridUnit = grid.gridUnit;
          } else {
            this.settings.grid = false;
          }
        }
        //Run the game
        this.run();
      }, this ) );
    },

    run: function() {
      $body.off();
      //create settings panel
      this.settingsPanel = new SettingsPanel();
      //Global message
      this.system = new SystemMessage();
      //Create chat
      this.chat = new Chat({load:this.settings.chatData});
      //Make sure we have a command list
      this.commands = new Commands();
      //Uploaded object/draggable object list
      this.objects = new ObjectList({load:this.settings.objects});
      //All interactions with the canvas
      this.canvas = new CanvasManager({
        canvasHeight: this.settings.canvasHeight,
        canvasWidth: this.settings.canvasWidth
      });
      
      //Fog
      this.fog = new Fog({mainCanvas: this.canvas});
      //Add our event listeners
      this.addEventListeners();
      //Add socket listeners
      this.addSocketListeners();
      //Run intial layer
      this.commands.runInitialCommand();
      //Set initial layer
      this.setInitialLayer();
      //Update our intial settings
      this.updateSettingsWithoutDispatch(this.settings);
      //Load the canvas
      this.canvas.loadCanvas(this.settings.canvas);
      //Update UI
      this.setUI();
      //Enable hotkeys
      this.enableHotKeys();
      //Move canvas to center
      this.canvas.center();
      //Allow the canvas to save
      this.canvas.addSaveListener();
      //this.canvas.enableFog();
      //Hide the loading screen, we're ready to go!
      this.loading.hide();
    },

    addEventListeners: function() {
      //Store inputs into local variables
      this.$gridSize = $body.find('.grid-size');
      this.$gridUnit = $body.find('.grid-unit');
      this.$gridLabel = $body.find('.grid-label');
      this.$gridColor = $body.find('.grid-color');
      this.$gridSettings = $body.find('.grid-settings');
      this.$canvasWrapper = $body.find('.canvas-wrapper');
      this.$editorColor = $body.find('.editor-color');
      this.$editor = $body.find('.editor');
      this.$subMenus = $body.find('.sub-menu');
      this.$freeDrawMenu = $body.find('.sub-menu.free-draw');
      this.$freeDrawStrokeWidth = this.$freeDrawMenu.find('.freeDrawStrokeWidth');
      //hasfocus class for editor
      $editor = this.$editor;
      $body.on('click','.editor',_.bind( function() {
        $editor.addClass('hasfocus');
      }, this ) );
      $body.on('click',':not(.editor)',function() {
        if ( $(this).find('.editor').size() === 0) {
          $editor.removeClass('hasfocus');
        }
      });

      //Tabs
      $body.on('click','[data-toggle="tab"]', function() {
        var $this = $(this);
        $body.find($this.closest('[data-tab-panels]').data('tab-panels')).hide();
        $body.find($(this).data('target')).css('display','table-row');
      } );

      $body.on('click','[data-toggle-class]', function() {
        var $target = $body.find($(this).data('target')),
            className = $(this).data('toggle-class');
        $target.toggleClass(className);
      } );

      /*$body.on('change','.select-file :file',function(e) {
        var $this = $(this),
            $parent = $this.parent(),
            value = $this.val();
        console.log('file');
        if( value === '' ) {
          $parent.removeClass('selected');
        } else {
          $parent.addClass('selected');
          $body.find('.filename').html(value.replace(/^.*[\\\/]/, ''));
        }
      });*/

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
        //console.log($target);
        $target.val('');
      })

      //Updates the color of the background
      this.$editorColor = $body.find('.editor-color');
      this.$editorColor.ColorPicker({
        onSubmit: function(hsb, hex, rgb, el) {
          this.$editorColor.val('#' + hex);
        },
        onBeforeShow: function () {
          $(this).ColorPickerSetColor(this.value);
        },
        onChange: _.bind( function (hsb, hex, rgb) {
          var color = '#' + hex;
          this.$editorColor.val(color);
        }, this )
      });

      //Free draw stroke color
      this.$freeDrawStroke = this.$freeDrawMenu.find('.freeDrawStroke');
      this.$freeDrawStroke.ColorPicker({
        onSubmit: function(hsb, hex, rgb, el) {
          this.$freeDrawStroke.val('#' + hex);
        },
        onBeforeShow: function () {
          $(this).ColorPickerSetColor(this.value);
        },
        onChange: _.bind( function (hsb, hex, rgb) {
          var color = '#' + hex;
          this.$freeDrawStroke.val(color);
          this.settings.freeDrawColor = color;
          this.canvas.setFreeDraw();
        }, this )
      });
      //Free draw fill color
      this.$freeDrawFill = this.$freeDrawMenu.find('.freeDrawFill');
      this.$freeDrawFill.ColorPicker({
        onSubmit: function(hsb, hex, rgb, el) {
          this.$freeDrawFill.val('#' + hex);
        },
        onBeforeShow: function () {
          $(this).ColorPickerSetColor(this.value);
        },
        onChange: _.bind( function (hsb, hex, rgb) {
          var color = '#' + hex;
          this.$freeDrawFill.val(color);
          this.settings.freeDrawFill = color;
          this.canvas.setFreeDraw();
        }, this )
      });
      //Free draw stroke width
      $body.on('change','.freeDrawStrokeWidth', _.bind( function() {
        this.settings.freeDrawWidth = parseInt(this.$freeDrawStrokeWidth.val());
        this.canvas.setFreeDraw();
      }, this ) );

      //Allows the objects to be droppable on the canvas
      this.$canvasWrapper.droppable({
        drop: _.bind( function( event, ui ) {
          //FIXME: This is just temporary until we have uploads
          if( ui.helper.find(':text').size() ) {
            var url = ui.helper.find(':text').val(),
                type = 'item';
          } else {
            var url = ui.helper.data('url');
                type = ui.helper.data('type');
          }
          //If there us a url, clear the text field (if there is one)
          //and trigger a load image on the canvas
          if( url !== '' ) {
            ui.draggable.find(':text').val('');
            this.canvas.trigger('loadImage',{url:url,type:type},event);
          }
          this.$editor.trigger('click'); //Focus
        }, this )
      });

      // --- GRID SETTINGS ---- //
      //Turn grid on
      $body.on('click','.grid-on:not(.active)', _.bind( function() {
        this.$gridSettings.slideDown();
      }, scope ) );
      //Turn grid off
      $body.on('click','.grid-off:not(.active)', _.bind( function() {
        this.$gridSettings.slideUp();
      }, scope ) );
      //Change grid color
      this.$gridColor.ColorPicker({
        onSubmit: function(hsb, hex, rgb, el) {
          this.$gridColor.val('#' + hex);
        },
        onBeforeShow: function () {
          $(this).ColorPickerSetColor(this.value);
        },
        onChange: _.bind( function (hsb, hex, rgb) {
          var color = '#' + hex;
          this.$gridColor.val(color);
        }, this)
      });

      //Show sub menu
      $body.on('click','.commands [data-cmd]', function() {
        var cmd = $(this).attr('data-cmd'),
            drawType = $(this).attr('data-cmd-value');

        if( cmd === 'draw' ) {
          scope.showSubMenu('.free-draw',drawType);
        } else {
          scope.showSubMenu();
        }
        
      } );

      $body.on('click','[data-action][data-player]', function() {
        var $this = $(this),
            action = $this.attr('data-action'),
            username = $this.attr('data-target') ? $body.find($this.attr('data-target')).val() : $this.attr('data-player');

        if( action === 'promoteGM' || action === 'demoteGM' ) {
          scope.socket.emit('changePlayer',{type:action,playerUsername:username});
        } else if( action === 'removePlayer' ) {
          scope.socket.emit('removePlayer',{playerUsername:username});
        } else if( action === 'addPlayer' ) {
          console.log(username);
          scope.socket.emit('addPlayer',{playerUsername:username});
        }
      });
      
      //Save all our settings
      $body.on('click','.save-settings', _.bind( function() {
        this.updateSettings( {
          grid: $body.find('.grid-on.active').size() ? true: false,
          gridSize: this.$gridSize.val(),
          gridColor: this.$gridColor.val(),
          editorColor: this.$editorColor.val(),
          gridUnit: this.$gridUnit.val()
        } );
      }, this ) );
      $body.on('click','.cancel-settings', _.bind( function() {
        this.setUI();
      }, this ) );
    },

    /**
     * Declare a socket listener here and route it to the correct
     * object/action or whatever you want. Make sure to bind
     * the call to the proper scope.
     */
    addSocketListeners: function() {
      if( this.socketsAssigned ) {
        return;
      }
      //On receiving chat, use our chat object to receive the message
      //and make sure the scope being used is the chat object itself
      this.socket.on('chat', _.bind( this.chat.receiveData, this.chat ) );
      //Receiving a new object
      this.socket.on('objectAdded', _.bind( this.canvas.loadFromJSON, this.canvas ) );
      //Receiving a new object
      this.socket.on('objectModified', _.bind( this.canvas.loadFromJSON, this.canvas ) );
      //Removing old objects
      this.socket.on('objectRemoved', _.bind( function(data) {
        _.each(data.objects, _.bind( function(object) {
          this.canvas.removeObjectById(object.id,true);
        }, this ) );
        
      }, this ) );
      this.socket.on('playerLeft', _.bind( function(username) {
        console.log('Player left',username);
        this.removePlayer(username);
      }, this));

      this.socket.on('playerJoined', _.bind( function(data) {
        console.log('Player joined',data.user);
      }, this));

      this.socket.on('playerManageList', _.bind( function(data) {
        console.log('Player List',data);
        this.settingsPanel.updatePlayerList(data);
      }, this ) );

      this.socket.on('systemMessage', _.bind( function(data) {
        console.log(data);
        if( data.action ) {
          switch(data.action) {
            case 'addGM' :
              if( data.type === 'updatePlayer' ) {
                this.system.message('You have been promoted to a GM. Please <a onclick="window.location.reload();return false;">reload the game</a> to access your new GM abilities','success');
                break;
              }
            case 'removeGM' :
              //They have been demoted, prevent them from doing anything else
              if( data.type === 'updatePlayer' ) {
                this.destroy();
                this.loading.show('The heavens have cast you out to live among the mortals. <a onclick="window.location.reload();return false;">Reload the game</a> to walk among the world once more.','The GM has spoken!');
                break;
              }
            default:
              var type = (['success','error'].indexOf(data.type) !== - 1) ? data.type : false;
              console.log(type);
              this.system.message(data.message,type,true);
              break;
          }
        }
      }, this));

      this.socket.on('sessionLibraryUpdate', _.bind( function(data) {
        console.log('Object Library Updated');
        this.objects.loadData(data);
       // this.settings.objects = data;
       // this.objects = new ObjectList({load:this.settings.objects});
      }, this));

      this.socket.on('gameSettingsChanged', _.bind( function(data) {
        console.log('Game settings changed',data);
        this.updateSettingsWithoutDispatch(data);
        this.setUI();
      }, this ) );

      this.socket.on('disconnect', _.bind( function(s) {
        if( s === 'booted') {
          this.loading.show("No saving throw here. You've been booted. Critical Hit!",'For shame!');
        } else {
          this.loading.show('Disconnected from Server. Trying to reestablish connection');
        }
      }, this));
      

      this.socketsAssigned = true;
    },

    destroy: function() {
      this.socket.removeAllListeners();
      $body.off();
      $body.find('.editor,.panel').remove();
    },

    /**
     * Adds a player into the game
     */
    addPlayer: function(data) {
      //console.log('Joined player data:',data);
      if( ! this.players ) {
        this.players = {};
      }
      //Create a player
      this.players[data.username] = new Player(data);
    },

    removePlayer: function(username) {
      delete this.players[username];
    },

    /**
     * Updates settings and initiates the proper changes
     */
    updateSettings: function( settings, noDispatch ) {
      //Turn grid on
      if( settings.hasOwnProperty('grid') && settings.grid ) {
        this.canvas.setGrid(this.settings.gridSize,this.settings.gridColor);
        this.toggleGridLabel('show');
        //Change grid size
        if( settings.hasOwnProperty('gridSize') && settings.hasOwnProperty('gridColor') ) {
          this.canvas.setGrid(settings.gridSize,settings.gridColor);
        }
      }
      //Turn grid off
      if( settings.hasOwnProperty('grid') && ! settings.grid ) {
        this.canvas.clearLayer('grid_layer');
        this.toggleGridLabel('hide');
      }
      

      //Change background color
      if( settings.hasOwnProperty('editorColor') ) {
        this.canvas.setBackgroundColor(settings.editorColor);
      }
      if( settings.hasOwnProperty('enableFog') ) {
        if( settings.enableFog ) {
          this.fog.enable();
        } else {
          this.fog.disable();
        }
      }
      //Update our settings object
      this.settings = $.extend(this.settings,settings);

      //Change grid size
      if( this.settings.grid && (settings.hasOwnProperty('gridSize') || settings.hasOwnProperty('gridUnit')) ) {
        this.updateGridLabel(this.settings.gridUnit)
      }
      //Canvas has been modified
      if( ! noDispatch ) {
        this.socket.emit('changeGameSettings',settings);
        this.canvas.trigger('canvas:modified');
      }
    },

    updateSettingsWithoutDispatch: function(settings) {
      this.updateSettings(settings,true);
    },

    /**
     * Hides all the sub menus and shows the sub menu with a given
     * class (or selector). Also sets the data type attribute
     * with the passed in option
     */
    showSubMenu: function(menu,option) {
      this.$subMenus.hide();
      $body.find('.sub-menu'+menu).show().attr('data-type',option);
    },

    //Finds the menu item with the initial layer and triggers a click on it,
    //which then trigger an action to set the actual canvas
    setInitialLayer: function() {
       $body.find('.commands .layer-menu [data-cmd-value="'+this.settings.initialLayer+'"]').trigger('click');
    },

    /**
     * Sets UI items with our given settings
     */
    setUI: function() {
      //Always set these things
      this.$freeDrawStroke.val(this.settings.freeDrawColor);
      this.$freeDrawFill.val(this.settings.freeDrawFill);
      this.$freeDrawStrokeWidth.find('option[value="'+this.settings.freeDrawWidth+'"]').prop('selected',true);
      //These options are only available if you're a GM
      if( driftwood.engine.player.isGM() ) {
        this.$editorColor.val(this.settings.editorColor);
        this.$gridColor.val(this.settings.gridColor);
        this.$gridSize.val(this.settings.gridSize);
        this.$gridUnit.val(this.settings.gridUnit);
        $body.find('.grid-'+(this.settings.grid ? 'on' : 'off')).trigger('click');
      //Make sure the form fields are disabled on settings, they can't do anything right now
      } else {
        $body.find('.save-settings, .cancel-settings').prop('disabled',true);
      }
    },

    enableHotKeys: function() {
      $body.bind('keydown.del', _.bind( function(e) {
        return this.handleHotKeys('delete',e);
      }, this ) );
      $body.bind('keydown.backspace', _.bind( function(e) {
        this.handleHotKeys('delete',e);
        return false;
      }, this ) );
      $body.bind('keydown.ctrl_c keydown.meta_c', _.bind( function(e) {
        return this.handleHotKeys('copy',e);
      }, this ) );
      $body.bind('keydown.ctrl_v keydown.meta_v', _.bind( function(e) {
        return this.handleHotKeys('paste',e);
      }, this ) );
      $body.bind('keydown.ctrl_x keydown.meta_x', _.bind( function(e) {
        return this.handleHotKeys('cut',e);
      }, this ) );
      //Lock objects
      $body.bind('keydown.ctrl_l keydown.meta_l', _.bind( function(e) {
        return this.handleHotKeys('lock',e);
      }, this ) );
      //Unlock objects
      $body.bind('keydown.ctrl_u keydown.meta_u', _.bind( function(e) {
        return this.handleHotKeys('unlock',e);
      }, this ) );
      //
      $body.bind('keydown.ctrl_up keydown.meta_up', _.bind( function(e) {
        return this.handleHotKeys('moveObject',e,'toFront');
      }, this ) );
      $body.bind('keydown.ctrl_down keydown.meta_down', _.bind( function(e) {
        return this.handleHotKeys('moveObject',e,'toBack');
      }, this ) );
      $body.bind('keydown.ctrl_left keydown.meta_left', _.bind( function(e) {
        return this.handleHotKeys('moveObject',e,'backwards');
      }, this ) );
      $body.bind('keydown.ctrl_right keydown.meta_right', _.bind( function(e) {
        return this.handleHotKeys('moveObject',e,'forwards');
      }, this ) );
      $body.bind('keydown.ctrl_1 keydown.meta_1', _.bind( function(e) {
        return this.handleHotKeys('switchObjectLayer',e,'map_layer');
      }, this ) );
      $body.bind('keydown.ctrl_2 keydown.meta_2', _.bind( function(e) {
        return this.handleHotKeys('switchObjectLayer',e,'object_layer');
      }, this ) );
      $body.bind('keydown.ctrl_3 keydown.meta_3', _.bind( function(e) {
        return this.handleHotKeys('switchObjectLayer',e,'gm_layer');
      }, this ) );
      $body.bind('keydown.1', _.bind( function(e) {
        return this.handleHotKeys('switchLayer',e,'map_layer');
      }, this ) );
      $body.bind('keydown.2', _.bind( function(e) {
        return this.handleHotKeys('switchLayer',e,'object_layer');
      }, this ) );
      $body.bind('keydown.3', _.bind( function(e) {
        return this.handleHotKeys('switchLayer',e,'gm_layer');
      }, this ) );
      $body.bind('keydown.m', _.bind( function(e) {
        return this.handleHotKeys('selectCanvas',e);
      }, this ) );
      $body.bind('keydown.f', _.bind( function(e) {
        return this.handleHotKeys('draw',e,'free');
      }, this ) );
      $body.bind('keydown.r', _.bind( function(e) {
        return this.handleHotKeys('draw',e,'rectangle');
      }, this ) );
      $body.bind('keydown.c', _.bind( function(e) {
        return this.handleHotKeys('draw',e,'circle');
      }, this ) );
      $body.bind('keydown.ctrl_shift_up keydown.meta_shift_up', _.bind( function(e) {
        return this.handleHotKeys('zoomIn',e);
      }, this ) );
      $body.bind('keydown.ctrl_shift_down keydown.meta_shift_down', _.bind( function(e) {
        return this.handleHotKeys('zoomOut',e);
      }, this ) );
    },

    handleHotKeys: function(command,e,data) {
      //IF the editor doesn't have focus, these don't need
      //to be executed
      if( ! this.$editor.hasClass('hasfocus') ) {
        return true;
      }
      //Can't paste if there's nothing copied
      if( command === 'paste' && ! this.canvas._cloned.length ) {
        return true;
      }
      //Can't do this if they're not a gm
      if( data === 'gm_layer' && ! driftwood.engine.player.isGM() ) {
        return true;
      }

      //These commands are command pallete commands (need to trigger click)
      if( ['switchLayer','selectCanvas','draw','zoomIn','zoomOut'].indexOf(command) !== -1 ) {
        console.log(command,data);
        var selector = '.commands [data-cmd="'+command+'"]';
        if( data ) {
          selector += '[data-cmd-value="'+data+'"]';
        }
        $body.find(selector).trigger('click');
        return false;
      }
      return this.sendContextCommand(command,e,data)
    },

    sendContextCommand: function(command,e,data) {
      if( ! this.$('.editor').hasClass('hasfocus') ) {
        return true;
      }
      //Grab context objects we would be doing 
      var objects = this.canvas.getContextObjects(e);
      
      //Must have objects to do commands if not paste
      if( (! objects.length && command !== 'paste') ) {
        return true;
      }
      //Set context menu (make a function for this?)
      this.canvas.contextMenu = {objects: objects};
      //If the command is paste, we need to set the X/Y coordinates
      if( command === 'paste' ) {
        this.canvas.contextMenu.X = this.$('.canvas-wrapper').width()/2;
        this.canvas.contextMenu.Y = this.$('.canvas-wrapper').height()/2;
      }

      //Trigger the command
      this.commands.doCommand(command,data);
      //Remove reference to context menu
      this.canvas.contextMenu = false;
      return false;
    },

    /**
     * Updates the grid label with a unit.
     *
     * 1 block = unit
     */
    updateGridLabel: function(unit) {
      this.$gridLabel.find('.unit-label').html(unit);
    },

    /**
     * Hides or shows the grid label
     *
     * 1 block = unit
     */
    toggleGridLabel: function(type) {
      switch(type) {
        case 'show':
          this.$gridLabel.show();
          break;
        case 'hide':
          this.$gridLabel.hide();
          break;
      }
    },    

    /**
     * Activation helper for UI elements.
     *
     * data-activate - what do we want to activate
     * data-target - what element do we want to affect
     */
    dataActivate: function( object ) {
      var $object = $(object),
          activate = $object.attr('data-activate'),
          target = $object.attr('data-target'),
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

    generateUid: function(separator) {
        /// <summary>
        ///    Creates a unique id for identification purposes.
        /// </summary>
        /// <param name="separator" type="String" optional="true">
        /// The optional separator for grouping the generated segmants: default "-".    
        /// </param>

        var delim = separator || "-";

        function S4() {
            return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
        }

        return (S4() + S4() + delim + S4() + delim + S4() + delim + S4() + delim + S4() + S4() + S4());
    },

    //Makes a textarea elastic
    elasticize: function(a) {
      var b="overflow"+("overflowY" in document.getElementsByTagName("script")[0].style?"Y":""),e=function(h,g,j){if(g.addEventListener){for(var f=0;f<h.length;f++){g.addEventListener(h[f],j,0)}}else{if(g.attachEvent){for(var f=0;f<h.length;f++){g.attachEvent("on"+h[f],j)}}}};for(var c=0;c<a.length;c++){a[c].style[b]="hidden";a[c].__originalRows=a[c].rows;var d=function(f){var h=f.target||f.srcElement||this,g=h.scrollTop;h.scrollTop=1;while(h.scrollTop>0){var j=h.clientHeight,i=true;h.rows++;if(h.clientHeight==j){if(h.style[b]){h.style[b]=""}h.scrollTop=g;return}h.scrollTop=1}if(!i){while(h.scrollTop==0&&h.rows>h.__originalRows){h.rows--;h.scrollTop=1}if(h.scrollTop>0){h.rows++}}if(!h.style[b]){h.style[b]="hidden"}};e(["keyup","paste"],a[c],d);d({target:a[c]})}
    },
 
  } );

  LoadingScreen = Backbone.View.extend( {
    el: $('.loading-screen'),

    /**
     * Collection of all our loading
     * messages.
     * @type {Array}
     */
    defaultMessages: [
      'Slaying dragons...',
      'Rolling dice...',
      'Picking random citizens pockets...',
      'Pillaging villages...',
      'Opening treasure chests...',
      'Ducking goblins...',
      'Rolling for save...',
      'Cursing the GM...',
      'Looting corpses...'
    ],

    /**
     * Min range of message delay
     * @type {Number}
     */
    messageDelayMin: 600,

    /**
     * Max range of message delay
     * @type {Number}
     */
    messageDelayMax: 1200,

    /**
     * How long once the hide loading screen
     * function is called before the loading
     * screen actually hides.
     * @type {Number}
     */
    hideDelay: 0,

    initialize: function(options) {
      //Set messages element
      this.$message = $(this.el).find('.loading-message');
      this.$header = $(this.el).find('h1');
      //Set messages
      this.reloadMessages();
      //Kick off time out
      this.setMessageTimeout();
    },

    /**
     * Reload messages, shuffles the messages to
     * create a random order.
     */
    reloadMessages: function() {
      this.messages = _.shuffle(this.defaultMessages);
    },

    /**
     * Calls changeMessage in a random
     * amount of time
     */
    setMessageTimeout: function() {
      //Kick off timeout
      this.messageTimeout = setTimeout(_.bind(this.changeMessage,this),_.random(this.messageDelayMin,this.messageDelayMax));
    },
    /**
     * Change the loading message
     */
    changeMessage: function() {
      if( ! this.messages.length ) {
        this.reloadMessages();
      }
      //Set the new message
      this.$message.html(this.messages.pop());
      this.setMessageTimeout();
    },
    /**
     * Delay the hiding of the loading screen, sometimes
     * we join and set everything up rather quickly and it's
     * actually bad UX to flicker a loading screen on and off
     */
    hide: function() {
      setTimeout( _.bind( function() {
        clearTimeout(this.messageTimeout);
        $(this.el).hide();
      }, this ), this.hideDelay );
      
    },

    show: function(message,header) {
      header = (typeof header === 'string') ? header : 'Loading Game...';
      this.$header.html(header);
      this.$message.html(message);
      $(this.el).show(); 
    }
  });

  /**
   * Fog
   *
   * Maintains the fog view.
   *
   * At the moment this requires us to create a third canvas with pointer-events: none
   * over top of the other canvas's. This is because I can't figure out how to cover the 
   * Fabric canvas (with say a rectangle), and then clip pieces out of it without clipping
   * down the entire canvas. Probably has something to do with context.save() and context.restore(),
   * but I can't get it to work.
   *
   * TODO: CanvasManager will draw a rectangle on the canvas that will retrieves coordinates/size,
   * remove the rectangle, and send this view the points. This view will then clip out that rectangle
   * or reveal that area.
   *
   * TODO: Save clipped/revealed points
   *
   * TODO: More then rectangles?
   *
   * TODO: Resize fog layer on main canvas resize
   */
  Fog = Backbone.View.extend( {

    initialize: function(options) {
      _.bindAll(this,'render');
      //Add event listeners
      //this.addEventListeners();
      this.$canvasContainer = $body.find('.canvas-container');
    },

    enable: function() {
      //If the canvas doesn't already exist, create a third canvas with no pointer events
      if( ! this.canvas ) {
        this.$canvasContainer.append($('<canvas id="fogCanvas" style="position:absolute;left:0;top:0;pointer-events:none;"></canvas>'));
        this.canvas = this.$canvasContainer.find('#fogCanvas');
        this.canvas.attr( {
          width: driftwood.engine.settings.canvasWidth,
          height: driftwood.engine.settings.canvasHeight
        } );
        this.context = this.canvas[0].getContext('2d');
      }

      this.reset();
      //this.context.save();
      //TMP
      this.reveal();
      //this.reset();
    },

    //Simply hide the fog canvas
    disable: function() {
      if( this.canvas) {
        this.canvas.hide();
      }
    },

    /**
     * Resets the fog layer to be it's full, unrevealed state.
     *
     * FIXME: Doesn't actually reset it at the moment...
     * @access public
     * @return {[type]}
     */
    reset: function() {
      //this.context.restore();
      //Fills the entire canvas with a fog
      this.context.globalCompositeOperation = 'source-over';
      this.context.beginPath();
      this.context.fillStyle = "rgba(0,0,0,"+(driftwood.engine.player.isGM() ? '0.3' : '1')+")";
      this.context.fillRect(0,0,this.canvas.width(),this.canvas.height());
      this.context.fill();
    },

    /**
     * Reveals an area of the fog.
     *
     * FIXME: At the moment this just gets rid of a set rectangle.
     */
    reveal: function() {
      this.context.globalCompositeOperation = 'destination-out';
      this.context.beginPath();
      this.context.fillStyle = "rgb(0,0,0)";
      this.context.fillRect(100,100,150,250);
      this.context.fill();
    }
  });
  /**
   * Settings Panel
   *
   * Allows us to drag stuff onto the camvas, upload objects,
   * search objects.
   */
  SettingsPanel = Backbone.View.extend( {
     // Container element
    el: $('.settings-content'),


    //Grab the template from the page
    template: _.template($('#settingsPanelTemplate').html()),

    initialize: function(options) {
      this.options = options || {};
      _.bindAll(this,'render');
      //Render the panel
      this.render();
    },
    render: function() {
      $(this.el).html(this.template({isGM: driftwood.engine.player.isGM()}));
    },
    updatePlayerList: function(playerList) {
      var template = _.template($('#playerListTemplate').html());
      $(this.el).find('.player-list').html(template({
        players: playerList,
        isOwner: driftwood.engine.player.isOwner(),
        playerUsername: driftwood.engine.player.get('username')
      }));
    }
  } );
  /**
   * Settings Panel
   *
   * Allows us to drag stuff onto the camvas, upload objects,
   * search objects.
   */
  SystemMessage = Backbone.View.extend( {
     // Container element
    el: $('.system-message'),

    hideDelay: 8000,

    initialize: function(options) {
      this.options = options || {};
      _.bindAll(this,'render');
      this.$alert = $(this.el).find('.alert');
      this.$message = this.$alert.find('.message');
    },

    message: function(message,type,delayClose) {
      //console.log('Show message:',message);
      this.$alert.attr('class','alert');
      if( type ) {
        this.$alert.addClass('alert-'+type);
      }
      this.$message.html(message);
      $(this.el).slideDown();
      if( delayClose ) {
        this.messageTimeout = window.setTimeout( _.bind( function() {
          $(this.el).hide();
        }, this ), this.hideDelay );
      }
    }
    
  } );
  /**
   * Object List
   *
   * Allows us to drag stuff onto the camvas, upload objects,
   * search objects.
   */
  ObjectList = Backbone.View.extend( {
     // Container element
    el: $('.object-list ol'),


    //Grab the template from the page
    template: _.template($('#objectItemTemplate').html()),

    initialize: function(options) {
      this.options = options || {};
      _.bindAll(this,'render');
      //Add event listeners
      this.addEventListeners();
      //Run test data
      if( this.options.load ) {
        this.loadData(this.options.load);
      }
    },

    loadData: function(data) {
      $(this.el).empty();
      this.addToList(data);
    },

    addEventListeners: function() {
      var scope = this;
      //User has selected a file, gather values and do AJAX upload
      $body.on('change','.select-file :file',function(e) {
        var $this = $(this),
            $parent = $this.parent(),
            value = $this.val();
            type = $body.find('[name="upload-type"]').val(),
            csrf = $body.find('[name="_csrf"]').val(),
            uploadUrl = $body.find('[name="uploadUrl"]').val();
        //Insert AJAX call. On success call processServerData,
        //which should in turn call addToList
        
        var formdata = new FormData();
        formdata.append('assetFile', this.files[0]);
        formdata.append('type', type);
        formdata.append('_csrf', csrf);

        $.ajax({
          url: uploadUrl,
          data: formdata,
          processData: false,
          contentType: false,
          type: 'POST',
          success: function(data) {
            console.log(data);
            //scope.processServerData(data);
          },
          error: function( jqXHR, textStatus, errorThrown ) {
            console.log(jqXHR);
         }
        });
      });
    },

    processServerData: function(data) {
      //TODO: Data is information returned from the database. Do
      //any necessary checks, conversions necessary to pass to 
      //addToList()
      var arrayData = [];  
      arrayData.push(data);
      this.addToList(arrayData);
    },

    /**
     * Adds objects to our object list. You should pass in
     * an array of objects, even if there's one
     *
     * Each object should contain the following:
     * url: full url of image
     * thumbnail: url of thumbnail image
     * type: token|map|item
     * name: Name of file
     */
    addToList: function(objects) {
      
      if( typeof objects !== 'object') {
        objects = [objects];
      }

      _.each( objects, _.bind( function(object) {
        object.canDelete = false;//object.isOwner ? true : false;
        $(this.el).append(this.template(object));
      }, this ) );

      //Allows objects to be draggable onto the canvas
      $body.find('.object-list .object').draggable({helper:'clone',revert:'invalid',scroll:false,appendTo:'#Main' });
    }
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

    menuOptions: {},

    hasMenuOptions: true,

    initialize: function(options) {
      _.bindAll(this,'render');
      //Set menu options default
      this.menuOptions = {
        copy: false,
        cut: false,
        paste: false,
        edit: false,
        delete: false,
        lock: false,
        unlock: false,
        move_backward: false,
        move_forward: false,
        move_to_front: false,
        move_to_back: false,
        switch_layer: false,
      };
      //Set all our options
      this.options = options;
      this.objects = options.objects || false;
      this.copied = options.copied || false;
      this.X = options.x;
      this.Y = options.y;
      this.offsetX = options.offsetX;
      this.offsetY = options.offsetY;
      //Open up the menu
      this.open();
    },
 
    open: function() {
      //Build the menu, close other menus, render a new one
      this.buildContextMenu();
      this.close();
      if( this.hasMenuOptions ) {
        this.render();
      }
    },
    buildContextMenu: function() {
      if( this.objects.length > 0 ) {
        if( ! this.objects[0].isLocked() ) {
          this.menuOptions.lock = true;
        } else {
          this.menuOptions.unlock = true;
        }
        this.menuOptions.copy = true;
        this.menuOptions.cut = true;
        this.menuOptions.delete = true;
        this.menuOptions.move_backward = true;
        this.menuOptions.move_forward = true;
        this.menuOptions.move_to_front = true;
        this.menuOptions.move_to_back = true;
        this.menuOptions.switch_layer = true;
        this.menuOptions.gmLayer = driftwood.engine.player.isGM();
        
        if(this.copied) {
          this.menuOptions.paste = true;
        }
      } else if( this.copied ) {
        this.menuOptions.paste = true;
      } else {
        this.hasMenuOptions = false;
      }
      //TODO: Determine what options should be turned on or off
    },
    render: function() {
      $(this.el).append(this.template({menu:this.menuOptions}));
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

    initialize: function(options) {
      this.options = options || {};
      _.bindAll(this,'render');
      //Add event listeners
      this.addEventListeners();
      //Load up any intial chat data
      if( this.options.load ) {
        this.loadData(options.load);
      }
      //SCroll to bottom
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

    /**
     * Loads chat messages in without any sort of animation.
     * Most likely used for preloading chat information
     */
    loadData: function(chatData) {
      $(this.el).find('.messages').empty();
      _.each( chatData, _.bind( function( data ) {
        data.active = false;
        this.receiveData(data);
      }, this ) );
    },

    /**
     * Sends the message off to the server via a socket
     */
    sendMessage: function(input) {
      var $input = $(input),
          message = $input.val();
      //Clear the input
      $input.val('');
      //Send chat to server
      driftwood.engine.socket.emit('chat', message);
    },

    /**
     * Data should be an object with a message and username
     */
    receiveData: function(data) {
      //Render our new message
      this.render(data);
      //Remove the active class after rendered
      $(this.el).find('.messages .active').removeClass('active');
    },

    /**
     * Renders a message template and adds it to the messages
     * container.
     */
    render: function(data) {
      var $messages = $(this.el).find('.messages'),
          scrollTop = $messages[0].scrollTop,
          scrollHeight = $messages[0].scrollHeight,
          height = $messages.outerHeight();

      //Assume it's an active message
      data = $.extend({active:true},data);
      data.message = this.cleanMessage(data.message);
      //Append the message to our messages contianer
      $messages.append(this.template(data));

      //Were they at the bottom when we added the message?
      //If so, scroll. If not, don't ruin their scroll position
      if( (scrollHeight - scrollTop) == height  ) {
        this.scrollChat(100);
      }
    },

    /**
     * Escapes HTML special characters and turns new lines
     * into break tags. Also auto links 
     */
    cleanMessage: function(text) {
      //special characters and newlines to brs
      text = _.escape(text).replace(new RegExp('\r?\n', 'g'), '<br />');
      //Replace URLS. Matches http:// and www.
      //Since our last cleaning method turned / into characters, use that in the regex instead
      return text.replace(/((https?\:&#x2F;&#x2F;)|(www\.))(\S+)(\w{2,4})(:[0-9]+)?(&#x2F;|&#x2F;([\w#!:.?+=&%@!\-&#x2F;]))?/gi,
            function(url){
                var full_url = url;
                if (!full_url.match('^https?:\/\/')) {
                    full_url = 'http://' + full_url;
                }
                return '<a href="' + full_url + '">' + url + '</a>';
            });
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
    el: $('.editor'),

    //Grab the template from the page
    template: _.template($('#commandMenuTemplate').html()),

    subMenuDelay: 500,

    _lastCmd: false,

    initialize: function(options) {
      _.bindAll(this,'render');
      //Add event listeners
      this.addEventListeners();
      //Render our menu
      this.render();
    },
    render: function() {
      $(this.el).prepend(this.template({
        fog: driftwood.engine.settings.enableFog,
        gmLayer: driftwood.engine.player.isGM()
      }));
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
        var $this = $(this);
        $this.button('toggle');
        //Close all the open submenus
        $body.find('.command.open').removeClass('open');
        //After XX seconds, open the menu
        scope.commandTimer = window.setTimeout(function () {
          $this.closest('.command').addClass('open');
        }, scope.subMenuDelay );
        e.preventDefault();
        e.stopPropagation();
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
        //e.stopPropagation();
      } );
      $body.on('click',function() {
        $body.find('.command.open').removeClass('open');
      });
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
     * on driftwood.engine.canvas)
     */
    //controller neds it
    doCommand: function(command,value) {
      console.log('Command:',command,value);

      switch(command) {
        case 'moveCanvas' :
          driftwood.engine.canvas.trigger('moveCanvas',value);
          break;
        case 'selectCanvas' :
          driftwood.engine.canvas.trigger('selectCanvas',value);
          break;
        case 'draw' :
          driftwood.engine.canvas.trigger('draw',value);
          break;
        case 'switchLayer' :
          driftwood.engine.canvas.trigger('switchLayer',value);
          break;
        case 'zoomIn':
          driftwood.engine.canvas.trigger('zoomIn');
          break;
        case 'zoomOut':
          driftwood.engine.canvas.trigger('zoomOut');
          break;
        case 'copy':
          driftwood.engine.canvas.trigger('copy');
          break;
        case 'cut':
          driftwood.engine.canvas.trigger('cut');
          break;
        case 'paste':
          driftwood.engine.canvas.trigger('paste');
          break;
        case 'delete':
          driftwood.engine.canvas.trigger('delete');
          break;
        case 'lock':
          driftwood.engine.canvas.trigger('lockObject');
          break;
        case 'unlock':
          driftwood.engine.canvas.trigger('unlockObject');
          break;
        case 'moveObject':
          driftwood.engine.canvas.trigger('moveObject',value);
          break;
        case 'switchObjectLayer':
          driftwood.engine.canvas.trigger('switchObjectLayer',value);
          break;
      }
      //Command is not switch layer, so save the last command
      if( ['moveCanvas', 'selectCanvas', 'draw'].indexOf(command) !== -1 ) {
        this._lastCmd = {command:command,value:value};
      //Command IS switch layer, and they were doing something
      //previous so reactivate that command
      } else if ( this._lastCmd && command === 'switchLayer' ) {
        //FIXME: Make the button actove
        $body.find('.menu-btn[data-cmd="'+this._lastCmd.command+'"]').trigger('click');
      }
    },
  } );
  /**
   * A wrapper backbone model for our objects on the canvas. This will allow us to perform
   * simple functions on canvas objects by simply calling object.Method. Keeps track of 
   * some information that doesn't necessarily go out to the canvas
   */
  var Player = Backbone.Model.extend({
    //Defaults
    defaults: {
      username: '',
      displayName: '',
      isOwner: false,
      type: 'player'
    },
    initialize: function() {
      
    },

    isGM: function() {
      return this.get('type') === 'gm';
    },

    isOwner: function() {
      return this.get('isOwner') === true;
    }
  });
  /**
   * A wrapper backbone model for our objects on the canvas. This will allow us to perform
   * simple functions on canvas objects by simply calling object.Method. Keeps track of 
   * some information that doesn't necessarily go out to the canvas
   */
  var CanvasObj = Backbone.Model.extend({

    initialize: function() {
      //Set local references
      this.canvas = driftwood.engine.canvas.canvas;
      this.layers = driftwood.engine.canvas.layers;
      //Set attributes for easier .get() calls
      this.set({
        layer: this.get('object').get('layer'),
        layerIndex: this.getLayerIndex(this.get('object').get('layer')),
        objectType: this.get('object').get('objectType')
      });
    },

    /**
     * Since we work with different layers, we can't just sent to front of all objects.
     * We have to send to front of that layer. 
     */
    sendToFront: function(replace) {
      //Get the current layer name and index of this object
      var _objects = this.canvas.getObjects(),
          _index = _objects.indexOf(this.get('object')), //This objects index
          _layerIndex = this.get('layerIndex')//This object's layer index
          index = 0; //The layer index we're going to move this object to

      //Get the index of the front most object in the
      //same layer. 
      for( var i = 0; i < _objects.length; i++ ) {
        //Object is at top of stack, so we need to replace at the current
        //index when we get to a breaking point
        if( replace ) {
          index = i;
        }
        //If layer index of this object is greater than the layer we're
        //looking for, we have found our top most index. Break out of loop
        if( this.getLayerIndex(_objects[i].get('layer')) > _layerIndex ) {
          break;
        }
        index = i; //Our new index
      }
      //If the indexes do not match, this object is not 
      //at the front of its layer
      if( _index !== index ) {
        console.log('Moving object to index: '+index);
        this.canvas.moveTo(this.get('object'),index);
      }
    },

    sendToBack: function() {
      //Get the current layer name and index of this object
      var _objects = this.canvas.getObjects(),
          _index = _objects.indexOf(this.get('object')), //This objects index
          _layerIndex = this.get('layerIndex') //This object's layer index
          index = 0; //The layer index we're going to move this object to
      //Get the index of the front most object in the
      //same layer. 
      for( var i = _objects.length-1; i >= 0; i-- ) {
        //If layer index of this object is greater than the layer we're
        //looking for, we have found our top most index. Break out of loop
        if( this.getLayerIndex(_objects[i].get('layer')) < _layerIndex ) {
          break;
        }
        index = i; //Our new index
      }

      //If the indexes do not match, this object is not 
      //at the front of its layer
      if( _index !== index ) {
        console.log('Moving object to index: '+index);
        this.canvas.moveTo(this.get('object'),index);
      }
    },

    sendBackward: function() {
      //Get the current layer name and index of this object
      var _objects = this.canvas.getObjects(),
          _index = _objects.indexOf(this.get('object')), //This objects index
          _layerIndex = this.get('layerIndex') //This object's layer index
      if( _index > 0 && this.getLayerIndex(_objects[_index-1].get('layer')) === _layerIndex ) {
        console.log('Actually moving backwards');
        this.canvas.moveTo(this.get('object'),(_index-1));
      }
    },

    sendForward: function() {
      //Get the current layer name and index of this object
      var _objects = this.canvas.getObjects(),
          _index = _objects.indexOf(this.get('object')), //This objects index
          _layerIndex = this.get('layerIndex') //This object's layer index
      if( _index < (_objects.length - 1) && this.getLayerIndex(_objects[_index+1].get('layer')) === _layerIndex ) {
        console.log('Actually moving forward');
        this.canvas.moveTo(this.get('object'),(_index+1));
      }
    },

    switchLayer: function(layer) {
      this.get('object').set('layer',layer);
      this.initialize();
    },

     /**
     * Given a layer string, figures out what index the layer is at.
     */
    getLayerIndex: function(layer) {
      return driftwood.engine.canvas.getLayerIndex(layer);
    },
    /**
     * Fits the object to a given size. If canvas is passed in,
     * it will scale the object to the size of the canvas and center
     * it. Anything else will scale it to the size of a grid block
     */
    fitTo: function(what,scaleFactor) {
      var width = (what == 'canvas') ? driftwood.engine.settings.canvasWidth : driftwood.engine.settings.gridSize,
          height = (what == 'canvas') ? driftwood.engine.settings.canvasWidth : driftwood.engine.settings.gridSize;

      if( scaleFactor ) {
        width = width * scaleFactor;
        height = height * scaleFactor;
      }
      this.get('object').scaleToWidth(width);
      this.get('object').scaleToHeight(height);


      if( what === 'canvas' ) {
        this.get('object').center();
      }
    },
    /**
     * Locks an object. Does not allow it to move, have controls, and sets
     * a local attribute to true
     */
    lock: function() {
      this.get('object').set({
        lockMovementX: true,
        lockMovementY: true,
        hasControls: false,
        locked: true,
      });
    },
    /**
     * Unlocks the object. Allows the object to be moved or
     * manipulated again
     */
    unlock: function() {
      this.get('object').set({
        lockMovementX: false,
        lockMovementY: false,
        hasControls: true,
        locked: false,
      });
    },
    /**
     * Checks to see whether or not this object is locked
     */
    isLocked: function() {
      return this.get('object').get('locked');
    },
    /**
     * Makes this object unselectable (cannot click on it or move it),
     * as well as change the opacity a bit to make it a bit transparent
     */
    disable: function(opacity) {
      var object = this.get('object');
      object.selectable = false;
      //Cannot be an empty layer/undefined
      if( this.get('layer') && ['fog_layer','grid_layer'].indexOf(this.get('layer')) === -1 && (typeof opacity === 'undefined' || opacity == true) ) {
        object.opacity = 0.7;
      }
    },
    /**
     * Enables this object by making it selectable and setting its opacit
     * to full.
     */
    enable: function() {
      var object = this.get('object');
      object.selectable = true;
      object.opacity = 1;
    },

    getIndex: function() {
      var _objects = this.canvas.getObjects();
      return _objects.indexOf(this.get('object'));
    },

    isBeingControlled: function() {
      var controlledBy = this.get('object').get('controlledBy'),
          me = driftwood.engine.player.get('username');
      return ( controlledBy && controlledBy !== me );
    }
   
  });

  /**
   * CanvasManager
   *
   * Handles interaction with the canvas. Creating objects, moving them,
   * moving the canvas, etc.
   *
   * FIXME: Some of the utility objects are created in a really funky way
   * (you have to pass context and other weird things)
   *
   * TODO: Sub menu options for width and stroke/fill color
   * 
   */
  CanvasManager = Backbone.View.extend( {
    //Default width
    CANVAS_WIDTH: 3000,
    //Default HEIGHT
    CANVAS_HEIGHT: 3000,

    canvasMove: false,

    layers: [
      {
        layer_name: 'map_layer'
      },
      {
        layer_name: 'object_layer'
      },
      {
        layer_name: 'gm_layer'
      },
      {
        layer_name: 'fog_layer'
      },
      {
        layer_name: 'grid_layer'
      },
    ],

    enlivening: {},
    canvasScale: 1,
    _cloned: [],

    initialize: function(options) {
      _.bindAll(this,'render');
      this.options = options || {};
      this.CANVAS_WIDTH = this.options.canvasWidth || this.CANVAS_WIDTH;
      this.CANVAS_HEIGHT = this.options.canvasHeight || this.CANVAS_HEIGHT;
      
      //Store reference to our canvas object
      this.canvas = new fabric.Canvas('c',{margin: '100px'});
      //Sset our intial canvas width
      this.canvas.setWidth( this.CANVAS_WIDTH );
      this.canvas.setHeight( this.CANVAS_HEIGHT );

      //Create our drawing utility
      this.drawing = this.drawingUtil.init(this);

      //Local references to UI elements
      this.$canvasWrapper = $body.find('.canvas-wrapper');
      this.$canvasPadding = $body.find('.canvas-padding');
      this.$canvasContainer = $body.find('.canvas-container');
      this.$editorOverlay = $body.find('.editor .overlay');

      this.setEditorSize();

      //Zoom utility
      this.zoom = this.zoomUtil.init(this);

      this.canvas.freeDrawingBrush = new fabric['PencilBrush'](this.canvas);
      //Preload canvas options
      if( this.options.loadCanvas ) {
        this.loadCanvas(this.options.loadCanvas);
      }
      //Add event listeners
      this.addEventListeners();
      
      //Make sure we'll all sized up
      this.onResize();

    },

    addEventListeners: function() {
      //Backbone View event listeners
      //FIXME: Move all of these listeners into a listen for "commandGiven" or similar
      //event, and execute a runCommand method that rotues to the correct function
      this.on('moveCanvas selectCanvas draw switchLayer zoomIn zoomOut', _.bind(this.disableAll,this));
      this.on('moveCanvas', _.bind(this.activateCanvasMove,this));
      this.on('selectCanvas',_.bind(this.activateCanvasSelect,this));
      this.on('draw',_.bind(this.draw,this));
      this.on('switchLayer',_.bind(this.switchLayer,this));
      this.on('zoomIn',this.zoom.activateZoomIn,this);
      this.on('zoomOut',this.zoom.activateZoomOut,this);
      this.on('copy',_.bind(this.copy,this));
      this.on('cut',_.bind(this.cut,this));
      this.on('paste',_.bind(this.paste,this));
      this.on('delete',_.bind(this.deleteObject,this));
      this.on('lockObject',_.bind(this.lockObject,this));
      this.on('unlockObject',_.bind(this.unlockObject,this));
      this.on('moveObject',_.bind(this.moveObject,this));
      this.on('switchObjectLayer',_.bind(this.switchObjectLayer,this));
      this.on('loadImage',_.bind(this.loadImage,this));

      //Window listener
      $window.on('resize',this.onResize);

      //Canvas events
      this.canvas.on('object:added', _.bind( function(e) {
        //console.log('Object added to canvas',e);
        this.addObject(e.target);
      }, this ) );

      //Object(s) have been selected
      this.canvas.on('object:selected', _.bind( this.setSelectedObjects, this ) );
      this.canvas.on('selection:created', _.bind( this.setSelectedObjects, this ) );
      //Objects are no longer selected
      this.canvas.on('selection:cleared', _.bind( this.removeControl, this ) );
      //Object modified
      this.canvas.on('object:modified', _.bind( function(e) {
        this.trigger('object:modified', e.target);
      }, this ) );
      //Object moving
      this.canvas.on('object:moving', _.bind( function(e) {
        //this.trigger('object:modified', e.target);
      }, this ) );
      this.canvas.on('object:scaling', _.bind( function(e) {
        //this.trigger('object:modified', e.target);
      }, this ) );
      this.canvas.on('object:rotating', _.bind( function(e) {
        //this.trigger('object:modified', e.target);
      }, this ) );

      this.on('object:added', _.bind( function(object) {
        var json = this.toDataJSON(object);
        driftwood.engine.socket.emit('objectAdded',{objects:json});
      }, this ) );
      this.on('object:modified', _.bind( function(object) {
        var json = this.toDataJSON(object);
        driftwood.engine.socket.emit('objectModified',{objects:json});
      }, this ) );
      this.on('object:removed', _.bind( function(object) {
        var json = this.toDataJSON(object);
        driftwood.engine.socket.emit('objectRemoved',{objects:json});
      }, this ) );



      //Creates a context menu
      $body.on('contextmenu','.canvas-wrapper', _.bind(this.openContextMenu, this));

      //Close context menu
      $body.on('click', _.bind( function() {
        if( this.contextMenu ) {
          this.contextMenu.close();
          this.contextMenu = false;
        }
      }, this ) );
      
    },

    addSaveListener: function() {
      this.on('object:added object:removed object:modified canvas:modified', _.bind( function(e) {
        //We do not want to emit a save of the object being changed is the grid, we let the canvas:modified
        //event handle that.
        if( e && e.layer && e.layer === 'grid_layer' ) {
          return false;
        }
        var canvasJSON = this.canvas.toJSON();
        //This canvas has objects, we need to normalize them before saving
        if( canvasJSON.objects.length ) {
          //Get all objects in singular form (canvas.toJSON will bring stuff in as groups if in selection)
          var objects = this.canvas.getObjects(),
              _objects = []; //Objects we'll store to when done
          _.each( objects, _.bind( function(object) {
            //Not a grid object, so run it through data json function (which will normalize and restore from groups)
            if( object.get('layer') !== 'grid_layer' ) {
              _objects = _objects.concat(this.toDataJSON(object));
            //Is a grid, just normalize it
            } else {
              _objects = _objects.concat(this.normalizeObjects([object.toJSON()]));
            }
          }, this) );
          //Save our objects
          canvasJSON.objects = _objects;
          //console.log('Saving data',canvasJSON,e);
        }
        driftwood.engine.socket.emit('saveCanvas',JSON.stringify(canvasJSON));
      }, this ) );
    },

    loadCanvas: function(data) {
      //console.log('Loading Data',JSON.parse(data));
      this.canvas.loadFromJSON(data, _.bind( function() {
        var _objects = this.canvas.getObjects();
        //console.log(_objects);
        if( _objects.length ) {
           _objects.forEach(_.bind( function(object) {
            this.updateObjectForPlayer(object);
          }, this ) );
        }
        //this.clearLayer('object_layer');
        this.canvas.renderAll();
      }, this ));
      
       
    },

    toDataJSON: function(object) {
      var objects = [],
          jsonObjects = [],
          canvasObjects = this.canvas.getObjects();
      //Might have multiple objects
      if( object._objects ) {
        //Order them by their position
        object._objects = this.orderByIndex(object._objects);
        //This is a group, we need to restore each object so the 
        //properties are not relative to the group
        _.each(object._objects, function( o ) {
          var index = canvasObjects.indexOf(o),
              _o = o;
          if( _o.group ) {
            var _o = fabric.util.object.clone(o);
            _o.group._restoreObjectState(_o);
          }
          _o.index = index;
          objects.push(_o);
        });
      } else {
        //This single object is part of a group, restore it!
        if( object.group ) {
          var object = fabric.util.object.clone(object);
          object.group._restoreObjectState(object);
        }
        object.index = canvasObjects.indexOf(object);
        objects.push(object);
      }

      //Go through each one and get their index
      objects.forEach( _.bind(function( object ) {
        var json = object.toJSON();
        //Add index into json data
        json['index'] = object.index;
        //Normalize scale/position
        json = this.normalizeObjects([json]).pop();
        jsonObjects.push(json);
      }, this ) );
      return jsonObjects;
    },

    normalizeObjects: function( objects ) {
      var _objects = [];
      _.each( objects, _.bind( function(json) {
        if( this.canvasScale !== 1 ) {
          json.scaleX = json.scaleX / this.canvasScale;
          json.scaleY = json.scaleY / this.canvasScale;
          json.left = json.left / this.canvasScale;
          json.top = json.top / this.canvasScale;
        }
        if( json.layer === 'grid_layer' ) {
          json.gridSize = driftwood.engine.settings.gridSize;
          json.gridUnit = driftwood.engine.settings.gridUnit;
        }
        _objects.push(json);
      }, this ) );
      return _objects;
    },

    /**
     * Sets objects as being controlled by the current user.
     * Will add the in ability to select or modify objects
     * if they are currently being controlled by someone else
     */
    setSelectedObjects: function(e) {
      //Make sure all objects are no longer being controlled by this player
      this.removeControl();
      //Gather selected objects
      var selected = [];
      if( ! e.target._objects ) {
        selected.push(e.target);
      } else {
        e.target.layer == this.currentLayer;
        selected = e.target._objects;
      }
      //console.log('Take control of objects',selected);
      //For each object, make it controlled by our current player
      _.each( selected, _.bind( function(object) {
        object.set('controlledBy',driftwood.engine.player.get('username'));
      }, this ) );
      if( selected.length) {
        this.trigger('object:modified',e.target);
      }
      
    },

    removeControl: function() {
      //console.log('Remove control of all my objects');
      var _objects = this.canvas.getObjects(),
          modified = [];
      _.each( _objects, _.bind( function(object) {
        //Not a grid, is already controlled by me, and is not active ( if it is active, it's being controlled by me)
        if( object.get('layer') !== 'grid_layer' && object.get('controlledBy') == driftwood.engine.player.get('username') && ! object.get('active')) {
          object.set('controlledBy',false);
          modified.push(object);
        }
      }, this ) );
      if( modified.length ) {
        this.trigger('object:modified',{_objects:modified})
      }
    },

    /**
     * Creates the grid lines for the canvas. Goes through all the vertical
     * lines, then all the horizontal lines. This function clears the entire
     * grid layer (as the grid should be the only thing on this layer)
     */
    setGrid: function(gridSize,gridColor) {
      var lines = [],
          layer = this.currentLayer;
      //Make sure grid size is a number
      if( ! parseInt(gridSize) ) {
        return;
      }
      //Take half of the size they want
      gridSize = (gridSize ? gridSize : gridSize)/2,
      //Switch to the grid layer so we can add all the lines
      this.switchLayer('grid_layer'); 
      //Make sure the grid layer is clear
      this.clearCurrentLayer();
      //Create all the vertical lines
      for( var i=gridSize; i<this.CANVAS_WIDTH; i+=gridSize) {
        var line = new fabric.Line([0,0,0,this.CANVAS_HEIGHT],{
          top: 0,
          //For whatever reason adding this line to a group starts everything
          //at the center, so always subtract half the canvas width
          left:  i-(this.CANVAS_WIDTH/2),
          stroke: gridColor,
          strokeWidth: 1,
          opacity: 0.7,
        });
        lines.push(line);
      }
      //Create all the horizontal lines
      for( var i=gridSize; i<this.CANVAS_HEIGHT; i+=gridSize) {
        var line = new fabric.Line([0,0,this.CANVAS_WIDTH,0],{
          //For whatever reason adding this line to a group starts everything
          //at the center, so always subtract half the canvas width
          top: i-(this.CANVAS_HEIGHT/2),
          left: 0,
          stroke: gridColor,
          strokeWidth: 1,
          opacity: 0.7,
        });
        lines.push(line);
      }
      //Add all the lines to a group so its's easier to maintain
      var lineGroup = new fabric.Group(lines,{
        left: 0,
        top: 0,
        width: this.CANVAS_WIDTH,
        height: this.CANVAS_HEIGHT,
        originX: 'left',
        originY: 'top',
        stroke: gridColor,
        strokeWidth: 1
      });

      //The canvas has been scaled, so we need to scale our lines down/up
      if( this.canvasScale ) {
        lineGroup.scale(this.canvasScale);
      }
      this.canvas.add(lineGroup);

      //Switch back to the actual current layer
      if( this.currentLayer !== layer ) {
        this.switchLayer(layer);
      }
      this.canvas.renderAll();
    },

    /**
     * Sets the grid color. 
     * 
     * FIXME: This assumes that the grid is the 
     * top most object (grid is the top most layer ). It double
     * checks so it doesn't throw errors, but there's a dependency
     * here that might need some alteration
     */
    setGridColor: function(color) {
      var _objects = this.canvas.getObjects(),
          //Grid is always the object on top
          grid = _objects[_objects.length-1];
      //Just make sure we have a grid full of objects (lines)
      if( grid.toJSON().layer === 'grid_layer' && grid._objects.length ) {
        _.each( grid._objects, function(object) {
          object.set('stroke',color);
        });
        this.canvas.renderAll();
      }
    },

    setBackgroundColor: function(color) {
      this.canvas.backgroundColor = color;
      this.canvas.renderAll();
    },

     orderByIndex: function(objects) {
      if( ! objects || ! objects.length ) {
        return objects;
      }
      var _objects = this.canvas.getObjects();
      
      return _.sortBy(objects, function(object) {
        return _objects.indexOf(object);
      });
    },

    toCanvasObjects: function(objects) {
      var canvasObjects = [];
      _.each( objects, function(object) {
        canvasObjects.push(object.get('object'));
      });
      return canvasObjects;
    },

    setEditorSize: function() {
      //console.log('Setting editor size');
      this.$canvasPadding.css({
        width: this.$canvasContainer.outerWidth(),
        height: this.$canvasContainer.outerHeight()
      });
      //this.$canvasContainer.css('position','fixed');
    },

    /**
     * Alias for "clearLayer", clears whatever the current set
     * layer is.
     */
    clearCurrentLayer: function() {
      this.clearLayer(this.currentLayer);
    },

    /**
     * Clears all the objects from a given layer. Loops through
     * all the objects and checks their layer vs the layer
     * passed in, if it matches, it gets removed.
     */
    clearLayer: function(layer) {
       var _objects = this.getObjects();
      _.each( _objects, _.bind( function(object) {
        if( object.get('layer') === layer ) {
          this.removeObject(object.get('object'));
        }
      }, this ) );
    },

    getContextObjects: function(e) {
      var objects = this.getActiveGroup() || [];
      //No active group, try to get a single active object
      if( ! objects.length ) {
        var object = this.getActiveObject();
        if( object ) {
          objects.push(object);
        }
      }
      //There is no active target, but let's try to grab one
      if( ! objects.length ) {
        var target = this.canvas.findTarget(e);
        if( target ) {
          this.canvas.setActiveObject(target);
          objects.push(this.getActiveObject());
        }
      }
      return objects;
    },

    /**
     * Opens up a context menu based on the currently active object, or group
     * of objects. If no object is active, it attempts to find a target. If
     * an object is still not found, it's assumed that empty canvas has been
     * clicked on.
     */
    openContextMenu: function(e) {
      var objects = this.getContextObjects(e);
      //Create our context menu
      this.contextMenu = new ContextMenu({
        x: e.clientX,
        y: e.clientY,
        offsetX: this.offsetLeft() + e.clientX,
        offsetY: this.offsetTop() + e.clientY,
        objects: objects,
        copied: this._cloned
      });

      e.preventDefault();
    },

    /**
     * Clones objects saved into the context menu.
     */
    copy: function() {
      var _objects = [];

      if( this.contextMenu.objects.length ) {
        _.each( this.contextMenu.objects, _.bind( function(object) {
          _objects.push(fabric.util.object.clone(object.get('object')));
        }, this ) );
      }

      this._cloned = _objects;
    },

    /**
     * Cuts an object: copies the objects then removes them
     */
    cut: function() {
      this.copy();
      this.deleteObject();
    },

    /**
     * Goes through cloned objects and adds them to the canvas as new objects.
     * If there is more than one, it was part of a group copy, so we have to
     * set their top/left positions + the mouse position. Also, for some reason
     * cloned objects in a group have hasControls: false, so set that.
     *
     * FIXME: Move canvasWrapper.scrollTop into a function so we can do something like
     * this.top() and this.left()
     *
     */
    paste: function() {
      if( this._cloned.length ) {
        var canvasWrapper = $body.find('.canvas-wrapper')[0];
        this.canvas.deactivateAllWithDispatch();
        _.each( this._cloned, _.bind(function(object) {
          object = fabric.util.object.clone(object);
          object.set({
            id: driftwood.engine.generateUid(),
            layer: this.currentLayer,
            //Group objects take mouse position + object position since it's a number
            //relative to the group
            top: this.offsetTop() + this.contextMenu.Y + (this._cloned.length > 1 ? object.toObject().top : 0),
            left: this.offsetLeft() + this.contextMenu.X + (this._cloned.length > 1 ? object.toObject().left : 0),
            hasControls: true
          });
          this.canvas.add(object);
          this.trigger('object:added', object);
          //this.canvas.setActiveObject(object);
        }, this ) );
        this.canvas.deactivateAll();
        this.canvas.renderAll();
      }
    },

    /**
     * Removes all objects saved to the context menu
     */
    deleteObject: function() {
      if( this.contextMenu.objects.length ) {
        this.canvas.deactivateAll()
        _.each( this.contextMenu.objects, _.bind( function(object) {
          this.removeObject(object.get('object'));
        }, this ) );
        this.canvas.renderAll();
      }
    },
    /**
     * Locks all the objects
     */
    lockObject: function() {
      if( this.contextMenu.objects.length ) {
        //Need to make sure they're deactivated so the controls change
        this.canvas.deactivateAllWithDispatch();
        //Go through each object and lock it
        _.each( this.contextMenu.objects, _.bind( function(object) {
          object.lock();
        }, this ) );
        this.trigger('object:modified',{_objects: this.toCanvasObjects(this.contextMenu.objects)});
        this.canvas.renderAll();
      }
    },
    /**
     * Locks all the objects
     */
    unlockObject: function() {
      if( this.contextMenu.objects.length ) {
        this.canvas.deactivateAllWithDispatch();
        var selected = [];
        _.each( this.contextMenu.objects, _.bind( function(object) {
          object.unlock();
          //We're going to reselect these objects
          object.get('object').set('active',true);
          selected.push(object.get('object'));
        }, this ) );
        var group = new fabric.Group(selected);
        this.canvas.setActiveGroup(group).renderAll();
        this.trigger('object:selected',group);
      }
    },

    /**
     * Goes through all the objects saved to the context menu and
     * changes their index position.
     */
    moveObject: function(how) {
      if( this.contextMenu.objects.length ) {
        _.each( this.contextMenu.objects, _.bind( function(object) {
          switch( how ) {
            case 'forwards':
              object.sendForward();
              break;
            case 'backwards':
              object.sendBackward();
              break;
            case 'toFront':
              object.sendToFront();
              break;
            case 'toBack':
              object.sendToBack();
              break;
          }
          
        }, this ) );
        this.trigger('object:modified',{_objects: this.toCanvasObjects(this.contextMenu.objects)});
      }
    },

    /**
     * Goes through all the objects sent to the context menu
     * and switches what layer they are on. Makes sure to move
     * that object to the front of its layer.
     *
     * If the layer is not on the current layer (which it 
     * shouldn't be), we disable that object
     */
    switchObjectLayer: function(layer) {
      if( this.contextMenu.objects.length ) {
        this.canvas.deactivateAllWithDispatch()
        _.each( this.contextMenu.objects, _.bind( function(object) {
          object.switchLayer(layer);
          if( object.get('layer') !== this.currentLayer ) {
            var opacity = object.get('layerIndex') > this.getLayerIndex(this.currentLayer);
            object.disable(opacity);
          }
          object.sendToFront();
          this.trigger('object:modified',object.get('object'));
        }, this ) );
        this.canvas.renderAll();
      }
    },

    updateObjectForPlayer: function(object) {
      var object = this.toObject(object),
          canvasObject = object.get('object'),
          isLocked = object.isLocked();
      //console.log(object);
      //Enable and unlock it to start
      object.enable();
      object.unlock();
      //Object should be disabled, it's on another layer
      if( object.get('layer') !== this.currentLayer ) {
        var opacity = object.get('layerIndex') > this.getLayerIndex(this.currentLayer);
        object.disable(opacity);
      }
      //Object is suppose to be locked
      if( isLocked ) {
        object.lock();
      }
      //Object is being controlled, don't let it be selected
      if( object.isBeingControlled() ) {
        canvasObject.set('selectable',false);
      }
      //console.log(object.get('layer'));
      //Object is on the gm layer and the player is not a gm
      if( object.get('layer') === 'gm_layer' && ! driftwood.engine.player.isGM() ) {
        canvasObject.set('opacity',0);
      }

      //This player is zoomed, so we need to adjust the size/position of the incoming
      //object to match the zoom level
      if( this.canvasScale ) {
        canvasObject.set('scaleX',canvasObject.get('scaleX') * this.canvasScale);
        canvasObject.set('scaleY',canvasObject.get('scaleY') * this.canvasScale);
        canvasObject.set('left',canvasObject.left * this.canvasScale);
        canvasObject.set('top',canvasObject.top * this.canvasScale);
      }

      //Make sure coordinates are updated
      canvasObject.setCoords();
    },

    /**
     * Loads an image given a url.
     *
     * TODO: Constrain width/height?
     */
    loadImage: function(data,event) {
      try {
        fabric.Image.fromURL(data.url,  _.bind( function(oImg) {
          this.canvas.deactivateAll();
          var canvasWrapper = $body.find('.canvas-wrapper')[0];
          oImg.set({
            top: this.offsetTop() + event.clientY,
            left: this.offsetLeft() + event.clientX
          });
          //Set the type of object this is
          this.addedObjectType = data.type;
          //Add the object the canvas
          this.canvas.add(oImg);
          //Unset
          this.addedObjectType = null;
          this.canvas.setActiveObject(oImg);
        }, this ) );
      } catch( err ) {
        //TODO: Indicate something on the UI alerting user that we failed
        //to fetch the image
      }
    },

    getObjectById: function(id) {
      var _objects = this.canvas.getObjects();
      for( var i=0; i<_objects.length; i++) {
        if( _objects[i].get('id') == id ) {
          return _objects[i];
        }
      }
      return false;
    },

    /**
     * Alias for the canvas getActiveObject that turns the active
     * object into a local backbone model
     */
    getActiveObject: function() {
      var activeObject = this.canvas.getActiveObject();
      if( activeObject ) {
        activeObject = this.toObject(activeObject);
      }
      return activeObject;
    },
    /**
     * Alias for the canvas getActiveGroup that turns the active
     * group objects into a local backbone model
     */
    getActiveGroup: function() {
      var _objects = this.canvas.getActiveGroup(),
          activeGroup;
      if( _objects ) {
        activeGroup = [];
        _objects.forEachObject( _.bind( function(object) {
          activeGroup.push(object);
        }, this ) );
        activeGroup = this.toObjects(this.orderByIndex(activeGroup));
      }

      return activeGroup;
    },

     /**
     * Local alias for canvas.getObjects(). Uses this fabric method
     * to grab all the objects on the canvas and convert them to local
     * backbone objects.
     */
    getObjects: function() {
      var _objects = this.canvas.getObjects();
      //Clear out our current objects array
      var objects = [];
      _objects.forEach( _.bind( function(object) {
        objects.push(this.toObject(object));
      }, this ) );
      return objects;
    },

    /**
     * Turn canvas object into a local backbone model object
     */
    toObject: function(object) {
      return new CanvasObj({object: object});
    },

    toObjects: function(objects) {
      var converted = []
      _.each( objects, function(object) {
        converted.push(new CanvasObj({object: object}));
      });
      //console.log('Converted',converted);
      return converted;
    },

    /**
     * Adds an pbject to our local collection. Also extends the fabric canvas object
     * and throws it into a backbone model.
     */
    addObject: function(activeObject) {
      var newObject = activeObject.get('id') ? false : true;
      activeObject.toObject = (function(toObject) {
        return function() {
          return fabric.util.object.extend(toObject.call(this), {
            id: this.id,
            layer: this.layer,
            objectType: this.objectType,
            locked: this.locked,
            controlledBy: this.controlledBy
          });
        };
      })(activeObject.toObject);
      
      if( newObject ) {
        //console.log('Added object');
        var currentLayer = this.currentLayer;
        //Set all our intial attributes
        activeObject.set({
          id: driftwood.engine.generateUid(),
          layer: this.currentLayer,
          objectType: this.addedObjectType,
          locked: false,
          controlledBy: driftwood.engine.player.get('username')
        });

        //Move the object to the front of it's layer
        var object = this.toObject(activeObject);
        //If this is a token or item AND it was just added, scale it
        if( this.addedObjectType && ['token','item'].indexOf(object.get('objectType')) !== -1 ) {
          object.fitTo('grid',this.canvasScale);
        //Its a map, fit it to the canvas
        } else if( this.addedObjectType && ['map'].indexOf(object.get('objectType')) !== -1) {
          object.fitTo('canvas',this.canvasScale);
        }

        //Make sure the object is at the front of its layer
        object.sendToFront(true);
        //As long as this isn't something on the grid layer,
        //make sure the server knows an object has been added
        if( object.get('layer') !== 'grid_layer' ) {
          this.trigger('object:added', object.get('object'));
        }
      }

    },

    removeObject: function(object,noDispatch) {
      this.canvas.remove(object);
      if( noDispatch !== true ) { 
        this.trigger('object:removed',object);
      }
    },

    removeObjectById: function(id,noDispatch) { 
      this.removeObject(this.getObjectById(id),noDispatch);
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
    onResize: function() {
      $body.find('.canvas-wrapper').width($window.width()-$('.panel').outerWidth());
    },

    //Disables all our different canvas interactions
    disableAll: function() {
      this.canvas.deactivateAllWithDispatch();
      this.disableCanvasMove();
      this.drawing.circle.stopDrawing();
      this.drawing.rectangle.stopDrawing();
      this.canvas.isDrawingMode = false;
      this.canvas.selection = false;
      this.zoom.deactivateZoom();
    },

    //Draw something
    draw: function(what) {
      switch(what) {
        case 'free':
          this.canvas.isDrawingMode = true;
          this.setFreeDraw();
          break;
        case 'circle':
          this.drawing.circle.startDrawing();
          break;
        case 'rectangle':
          this.drawing.rectangle.startDrawing();
          break;
      }
      
    },

    setFreeDraw: function() {
      this.canvas.freeDrawingBrush.color = driftwood.engine.settings.freeDrawColor;
      this.canvas.freeDrawingBrush.width = driftwood.engine.settings.freeDrawWidth;
    },

    /**
     * Switches the currently active layer. Goes through all the
     * objects on the canvas and disabled anything that isn't this
     * layer and makes sure anything that IS on this layer is enabled
     */
    switchLayer: function(layer) {
      this.currentLayer = layer;
      var _objects = this.getObjects(),
          _layerIndex = this.getLayerIndex(this.currentLayer);
      //Go through each object and add it to the correct canvas
      _objects.forEach( _.bind( function(object) {
        //Not on this later, move to the tmp canvas
        if( object.get('layer') !== this.currentLayer ) {
          var opacity = object.get('layerIndex') > _layerIndex;
          object.disable(opacity);
        //Is the current layer, so let's interact with it
        } else {
          object.enable();
        }
      }, this ) );
      
      //Make sure everything is rendered
      this.canvas.deactivateAllWithDispatch().renderAll();
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
      //Show overlay so they're not clicking on the canvas
      $body.find('.editor .overlay').show();
      //add events
      $body.on('mousedown.canvasPan','.canvas-wrapper', _.bind( this.startCanvasMove, this ) );
      $body.on('mouseup.canvasPan', _.bind( this.stopCanvasMove, this ) );
      $body.on('mousemove.canvasPan','.canvas-wrapper', _.bind( this.moveCanvas, this ) );
    },
    //Removes event listeners for the canvas move
    disableCanvasMove: function() {
      $body.off('.canvasPan');
      //Hide overlay so they can interact with the canvas again
      $body.find('.editor .overlay').hide();
    },
    //Allows canvas to be moved (scrolled), sets original X/Y/scroll position
    startCanvasMove: function(e) {
      this.canvasMove = true;
      this.X = e.clientX;
      this.Y = e.clientY;
    },
    //Stops the canvas from being moved on mouse move
    stopCanvasMove: function() {
      this.canvasMove = false;
    },
    //Moving the canvas actually means we're adjusting the scrollLeft/Top.
    //We then adjust the scroll position to its original position + the 
    //mouse distance
    moveCanvas: function(e) {
      if( this.canvasMove ) {
        var moveY = e.clientY - this.Y,
            moveX = e.clientX - this.X;

        if( this.offsetLeft() - moveX > 0 ) {
          $body.find('.canvas-wrapper').scrollLeft( this.offsetLeft() + (- moveX) );
        }
        if( this.offsetTop() - moveY > 0 ) {
          $body.find('.canvas-wrapper').scrollTop( this.offsetTop + (- moveY) ) ;
        }
      }
      e.preventDefault();
    },
    //Grabs the offset left of the canvas, which is the scroll and the margin
    offsetLeft: function() {
      return this.$canvasWrapper[0].scrollLeft - this.$canvasContainer[0].offsetLeft;
    },
    //Grabs the offset left of the canvas, which is the scroll and the margin
    offsetTop: function() {
      return this.$canvasWrapper[0].scrollTop - this.$canvasContainer[0].offsetTop;
    },
    //Sets overlay size to size of the canvasWrapper
    setOverlaySize: function() {
      //console.log('Setting overlay size');
      this.$editorOverlay.hide();
      //If there is no scroll, set it to size 100%
      var width = this.$canvasWrapper.outerWidth() >= this.$canvasWrapper[0].scrollWidth ? '100%' : this.$canvasWrapper[0].scrollWidth,
          height = this.$canvasWrapper.outerHeight() >= this.$canvasWrapper[0].scrollHeight ? '100%' : this.$canvasWrapper[0].scrollHeight;
      this.$editorOverlay.css({width:width,height:height});
      this.$editorOverlay.show();
    },

    center: function() {
      this.$canvasWrapper[0].scrollTop = (this.$canvasPadding.outerHeight()/2) - (this.$canvasWrapper.height()/2) ;
      this.$canvasWrapper[0].scrollLeft = (this.$canvasPadding.outerWidth()/2) - (this.$canvasWrapper.width()/2);
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
     * FIXME: Only allow zoom in/out to a certain factor
     *
     * TODO: Add "fitToScreen" which will autozoom canvas to fit the screen
     * width/height and centers
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
          activateZoomIn: function() {
            this.zoom.deactivateZoom();
            //Show overlay so they're not clicking on the canvas
            this.$editorOverlay.show().addClass('zoom-in');
            //add events
            $body.on('click.zoom','.overlay', _.bind( this.zoom.In, this ) );
            this.setOverlaySize();
          },
          activateZoomOut: function() {
            this.zoom.deactivateZoom();
            //Show overlay so they're not clicking on the canvas
            this.$editorOverlay.show().addClass('zoom-out');
            //add events
            $body.on('click.zoom','.overlay', _.bind( this.zoom.Out, this ) );
            this.setOverlaySize();
          },
          deactivateZoom: function() {
            //Show overlay so they're not clicking on the canvas
            $body.find('.editor .overlay').hide().removeClass('zoom-in').removeClass('zoom-out');
            //add events
            $body.off('.zoom');
          },
          In: function(event) {
            // TODO limit the max canvas zoom in
            canvasScale = canvasScale * SCALE_FACTOR,
            
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
            this.canvasScale = canvasScale;
            canvas.renderAll();
            this.setOverlaySize();
            this.setEditorSize();
            this.center();
          },
          Out: function(e) {
            // TODO limit max cavas zoom out
            canvasScale = canvasScale / SCALE_FACTOR;
            //Set canvas size
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
            this.canvasScale = canvasScale;
            canvas.renderAll();
            this.setEditorSize();
            this.setOverlaySize();
            this.center();
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
        this.circle = this.circleUtil(this.canvas,context);
        this.rectangle = this.rectangleUtil(this.canvas,context);
        return this;
      },
      /**
       * Draw Circle
       *
       * These functions help draw a circle. Like always, one to activate/deactivate/
       * start/stop/draw
       */
      circleUtil: function(canvas,context) {
        return {
          canvas: canvas,

          scope: context,

          //Sets variables and adds events to the mouse
          startDrawing: function(canvas) {
            this.canvas.selection = false;
            _.bindAll(this,'startCircleDraw','stopCircleDraw','drawCircle');   
            this.canvas.on('mouse:down', this.startCircleDraw);
            this.canvas.on('mouse:up', this.stopCircleDraw);
            this.canvas.on('mouse:move', this.drawCircle);
            this.canvasWrapper = $body.find('.canvas-wrapper')[0];
            this.canvasContainer = $body.find('.canvas-container')[0];
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
            //console.log('starting circle draw');
            //Where did the mouse click start
            this.offsetLeft = this.scope.offsetLeft();
            this.offsetTop = this.scope.offsetTop();
            this.startX = this.offsetLeft + event.e.clientX;
            this.startY = this.offsetTop + event.e.clientY;

            //Don't start if this is already an object
            if( ! event.target ){
              //Create our "circle"
              var object = new fabric.Ellipse({
                left: this.startX,
                top: this.startY,
                originX: 'left',
                originY: 'top',
                rx: 0,
                ry: 0,
                selectable: false,
                stroke: driftwood.engine.settings.freeDrawColor,
                strokeWidth: driftwood.engine.settings.freeDrawWidth,
                fill: driftwood.engine.settings.freeDrawFill
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
              if(this.offsetLeft + event.e.clientX == this.startX && this.offsetTop + event.e.clientY == this.startY ){
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
              var width = (this.offsetLeft + event.e.clientX - this.startX),
                  height = (this.offsetTop + event.e.clientY - this.startY),
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
              this.scope.trigger('object:modified', this.circle);
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
      rectangleUtil: function(canvas,context) {
        return {
          canvas: canvas,

          scope: context,

          //Sets variables and adds events to the mouse
          startDrawing: function(makeActive) {
            this.canvas.selection = false;
            _.bindAll(this,'startRectangleDraw','stopRectangleDraw','drawRectange');   
            this.canvas.on('mouse:down', this.startRectangleDraw);
            this.canvas.on('mouse:up', this.stopRectangleDraw);
            this.canvas.on('mouse:move', this.drawRectange);
            this.canvasWrapper = $body.find('.canvas-wrapper')[0];
            this.canvasContainer = $body.find('.canvas-container')[0];
            //When this is done drawing, should the rectangle be active?
            this.makeActive = makeActive ? true : false;
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
            this.offsetLeft = this.scope.offsetLeft();
            this.offsetTop = this.scope.offsetTop();
            this.startX = this.offsetLeft + event.e.clientX;
            this.startY = this.offsetTop + event.e.clientY;
            //Don't start if this is already an object
            if( ! event.target ){
              //Create our "circle"
              var object = new fabric.Rect({
                left: this.startX,
                top: this.startY,
                originX: 'left',
                originY: 'top',
                width: 0,
                height: 0,
                selectable: false,
                stroke: driftwood.engine.settings.freeDrawColor,
                strokeWidth: driftwood.engine.settings.freeDrawWidth,
                fill: driftwood.engine.settings.freeDrawFill
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
              if(this.offsetLeft + event.e.clientX == this.startX && this.offsetTop + event.e.clientY == this.startY ){
                this.canvas.remove(this.rectangle);
              }
              
              this.rectangle.selectable = true;
              this.rectangle.setCoords();
              if( this.makeActive ) {
                this.canvas.setActiveObject(this.rectangle);
              }
              
              this.rectangle = null;
            }
          },
          //Technically the rectangle is already drawn. Here we are just
          //making it bigger
          drawRectange: function(event) {
            
            if( this.rectangle ){
              // Resize object as mouse moves
              var width = (this.offsetLeft + event.e.clientX - this.startX),
                  height = (this.offsetTop + event.e.clientY - this.startY),
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
              this.scope.trigger('object:modified', this.rectangle);
            }
          },
        }//END return
      }//END Circle UTIL
    },//ND Drawing UTIL

    /**
     * Alis for Fabric's native _enlivenDatalessObjects method.
     * Instead of completely clearing the canvas, this looks
     * for an index attribute in the object and will insert
     * the object at that position
     * 
     * @private
     * @param {Array} objects
     * @param {Function} callback
     */
    _enlivenObjects: function (objects, callback) {
      var _this = this,
          numLoadedObjects = 0,
          numTotalObjects = objects.length,
          _objects = [];

      /** @ignore */
      function onObjectLoaded(object, index) {
        object.index = index;
        _objects.push(object);
        object.setCoords();
        if (++numLoadedObjects === numTotalObjects) {
          callback && callback(_objects);
        }
      }

      /** @ignore */
      function loadObject(obj) {

        var pathProp = obj.paths ? 'paths' : 'path';
        var path = obj[pathProp];
        index = obj.index;

        delete obj[pathProp];

        if (typeof path !== 'string') {
          if (obj.type === 'image' || obj.type === 'group') {
            fabric[fabric.util.string.capitalize(obj.type)].fromObject(obj, function (o) {
              onObjectLoaded(o, index);
            });
          }
          else {
            var klass = fabric[fabric.util.string.camelize(fabric.util.string.capitalize(obj.type))];
            if (!klass || !klass.fromObject) return;

            // restore path
            if (path) {
              obj[pathProp] = path;
            }
            onObjectLoaded(klass.fromObject(obj), index);
          }
        }
        else {
          if (obj.type === 'image') {
            fabric.util.loadImage(path, function (image) {
              var oImg = new fabric.Image(image);

              oImg.setSourcePath(path);

              fabric.util.object.extend(oImg, obj);
              oImg.setAngle(obj.angle);

              onObjectLoaded(oImg, index);
            });
          }
          else if (obj.type === 'text') {

            if (obj.useNative) {
              onObjectLoaded(fabric.Text.fromObject(obj), index);
            }
            else {
              obj.path = path;
              var object = fabric.Text.fromObject(obj);
              /** @ignore */
              var onscriptload = function () {
                // TODO (kangax): find out why Opera refuses to work without this timeout
                if (Object.prototype.toString.call(fabric.window.opera) === '[object Opera]') {
                  setTimeout(function () {
                    onObjectLoaded(object, index);
                  }, 500);
                }
                else {
                  onObjectLoaded(object, index);
                }
              };

              fabric.util.getScript(path, onscriptload);
            }
          }
          else {
            fabric.loadSVGFromURL(path, function (elements) {
              var object = fabric.util.groupSVGElements(elements, obj, path);

              // copy parameters from serialied json to object (left, top, scaleX, scaleY, etc.)
              // skip this step if an object is a PathGroup, since we already passed it options object before
              if (!(object instanceof fabric.PathGroup)) {
                fabric.util.object.extend(object, obj);
                if (typeof obj.angle !== 'undefined') {
                  object.setAngle(obj.angle);
                }
              }

              onObjectLoaded(object, index);
            });
          }
        }
      }

      if (numTotalObjects === 0 && callback) {
        callback();
      }

      try {
        objects.forEach(loadObject, this);
      }
      catch(e) {
        fabric.log(e);
      }
    },

    loadFromJSON: function(json) {
      if (!json) return;

      // serialize if it wasn't already
      var serialized = (typeof json === 'string')
        ? JSON.parse(json)
        : json;

      /**
       * This code enlivens and creates/replaces all objects,
       * regardless of whether or not they already exist
       *
      this._enlivenObjects(serialized.objects, _.bind( function (objects) {
        _objects = this.canvas.getObjects();
        objects.forEach( _.bind( function(object) {
          if( existingObject = this.getObjectById(object.get('id')) ) {
            this.canvas.remove(existingObject);
          }
          this.updateObjectForPlayer(object);
         // console.log('Inserting at',object.index);
          this.canvas.insertAt(object,object.index);
          //var o = this.toObject(object);
          //o.switchLayer(o.get('layer'));
        }, this ) );
          
      }, this ) );
      this.canvas.renderAll();
      return this;
      */
     
     //-------------------------------------------------

     /**
      * This code only enlivens objects that don't yet exist
      * on the game board. If it does exist, it simply sets the
      * data and updates it.
      *
      * If it needs to be enlivened, it makes sure it isn't
      * already in the process of being elivened. If it is,
      * it updates the data (replacing older data with new)
      * and moves on. Once that object is enlivened, the object
      * is updated with the most recent data and updated.
      */
      //Filter out any existing objects
      _.each( serialized.objects, _.bind( function( data ) {
        //Object exists
        var existingObject = this.getObjectById(data.id);
        if( existingObject ) {
          //console.log('Object exists');
          existingObject.set(data);
          this.updateObjectForPlayer(existingObject);
          this.canvas.moveTo(existingObject,data.index);
        //This object isn't currently in the process of being enlivened
        } else if( ! this.enlivening[data.id] ) {
          //console.log('Need to enliven');
          //console.log('Object does not exist');
          //We're going to enliven this data
          this.enlivening[data.id] = data;
          //Make all of our objects into actual fabric canvas objects
          this._enlivenObjects([data], _.bind( function (objects) {
            //Go through each enlivened object and update it for the player,
            //and since it's new, add it in at the proper index
            objects.forEach( _.bind( function(object) {
              //Even though we just enlivened with this data,
              //use the most current set (in case another socket event
              //triggered for this object while we were creating the object)
              //console.log(this.enlivening[data.id]);
              object.set(this.enlivening[data.id]);
              this.updateObjectForPlayer(object);
              //console.log(object.toJSON());
              //Add the object to the top, then move it to the
              //correct spot
              this.canvas.add(object);
              this.canvas.moveTo(object,object.index);
              //We're done enlivening this object
              delete this.enlivening[data.id];
            }, this ) );
          }, this ) );
        //Object is being elivened, update the data for when it's done
        } else {
          this.enlivening[data.id] = data;
        }
      }, this ) );
      this.canvas.renderAll();
      return this;
    }

  } );
  
  /**
   * Initialize and create the driftwood engine.
   * After it has been created, kick it off with run().
   *
   * TODO: This is where we need to send in initial
   * options. The current preloaded chat data, players
   * already in the room, and data that needs to be loaded
   * in on run when the user joins the game. 
   *
   * TODO: Determine what preloaded data gets passed in here 
   * on page load, and what gets loaded in via sockets
   * 
   * @type {Object}
   */
  var driftwood = {
    engine: new Driftwood({
      liveUrl: liveUrl,
      gamename: gamename,
      owner: owner,
      //Example of preloaded chat data
      ////TODO: maybe these get loaded in via socket on connect?
      chatData: [
        {
          username: 'Ryan',
          message: 'Preloaded data'
        },
      ],
      //Example of preloaded upload objects
      //TODO: maybe these get loaded in via socket on connect?
      objects: [
        {
          url: '/images/driftwoodtutorial.png',
          thumbnail: '/images/driftwoodtutorial.png',
          type: 'token',
          name: 'Tutorial'
        },
        {
          url: '/images/tmp/goblin.png',
          thumbnail: '/images/tmp/goblin.png',
          type: 'token',
          name: 'Goblin'
        },
        {
          url: '/images/tmp/paladin.png',
          thumbnail: '/images/tmp/paladin.png',
          type: 'token',
          name: 'Paladin'
        },
        {
          url: '/images/tmp/fighter.png',
          thumbnail: '/images/tmp/fighter.png',
          type: 'token',
          name: 'Warrior'
        },
        {
          url: '/images/tmp/map.jpg',
          thumbnail: '/images/tmp/map.jpg',
          type: 'map',
          name: 'Map of Taul'
        },
        {
          url: '/images/tmp/mage.png',
          thumbnail: '/images/tmp/mage.png',
          type: 'token',
          name: 'Mage'
        },
        {
          url: '/images/tmp/treasureChest.png',
          thumbnail: '/images/tmp/treasureChest.png',
          type: 'item',
          name: 'Treasure Chest'
        },
      ],
    })
  }
});
