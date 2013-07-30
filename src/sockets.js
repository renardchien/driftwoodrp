/**
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License. 
**/

var middleware = require('./middleware');
var models = require('./models');
var _ = require('underscore');
var async = require('async');
var config = require('./config.js');
var utils = require('./utils');
var log = config.getLogger();

var io;
var socketStorage;

var clients = {};

var configureSockets = function(socketio, storageio) {
  io = socketio;
  socketStorage = storageio;
  io.sockets.on('connection', function(socket) {

    if(!socket.handshake.session) {
      return socket.disconnect('Session has expired');
    }

    socket.on('join', function(data) {

      middleware.findGame(data.gameName, data.owner, function(err, game) {
        if(err) {
          return socket.disconnect(err);
        }

        if(!game) {
          return socket.disconnect('game was not found');
        }

        middleware.getPermission(socket.handshake.session.player.id, game.id, function(err, doc) {
          if(err) {
            return socket.disconnect(err);
          }
          if(!doc) {
            return socket.disconnect('Not authorized');
          }


				  socket.join(data.gameName + "/" + data.owner);

				  socket.room = data.gameName + "/" + data.owner;

          socket.game = game;


          if(game.ownerUsername === socket.handshake.session.player.username) {
            socket.handshake.session.player.isOwner = true;
          } else {
            socket.handshake.session.player.isOwner = false;
          }

          if(doc.isGM === true) {
					  socket.handshake.session.player.type = "gm";
				  } else {
					  socket.handshake.session.player.type = "player";
				  }

				  var player = socket.handshake.session.player;
				  var chatHistory = [{}];
				  var objectLibrary = [{}];

				  async.parallel({
					  chat: function(asyncCallback) {
						  models.Session.sessionChatModel.findHistory(game.id, function(err, chats){
      	        if(err) {
      	          chatHistory = [{ displayName: "System", message: "Previous chats could not be loaded" }];
      	        } else {
      	          chatHistory = _.pluck(chats, 'clientObject');
              	}	

							  return asyncCallback(err, chatHistory);
          		});   
					  },
					  library: function(asyncCallback) {
						  models.Session.sessionLibraryModel.findLibrary(game.id, function(err, libraryData) {
      	        if(!err) {
      	          objectLibrary = _.pluck(libraryData, 'clientObject');
              	}	

							  return asyncCallback(err, _.pluck(objectLibrary));						  		
						  });
					  }}, function(err, doc) {

//              if(!clients[socket.room]) {
//                clients[socket.room] = {};
//              } 
//               
//              if(!clients[socket.room][player.username]) {
//                clients[socket.room][player.username] = [];
//              }

//              clients[socket.room][player.username].push(socket);

              socket.storageGamePlayer = "storagePlayer:" + socket.room + "/" + player.username;
              socket.storageGameRoom = "storageGameRoom:" + socket.room;
                
              socketStorage.sadd(socket.storageGamePlayer, socket.id, function(err, success) {

                if(err) {
                  sendSystemMessage(socket, 'error', 'join', 'An error occurred trying to connect to the game. Please try again.');
                  return socket.disconnect();
                }

                socketStorage.sadd(socket.storageGameRoom, socket.storageGamePlayer, function(err, success) {

                  if(err) {
                    socketStorage.srem(socket.storageGamePlayer, socket.id);
                    sendSystemMessage(socket, 'error', 'join', 'An error occurred trying to connect to the game. Please try again.');
                    return socket.disconnect();
                  }

                  io.sockets.in(socket.room).emit('playerJoined', { user: {username: player.username, displayName: player.displayName, type: player.type} });

						      socket.emit('joined', { user: {username: player.username, displayName: player.displayName, type: player.type, isOwner: player.isOwner}, 
                                          chatSession: chatHistory, 
                                          objectLibrary: objectLibrary, 
                                          canvas: game.canvas } );

                  returnGamePlayerList(socket);
                });
              });

					  }
				  );
					
			  });  

		  });

	  });

    socket.on('addPlayer', function(data){
                
        if(!data || !data.playerUsername) {
          return sendSystemMessage(socket, 'error', 'addPlayer', 'You must specify a player to add');
        }

        middleware.checkOwnership(socket.game.ownerUsername, socket.handshake.session.player.username, function(isOwner) {

          if(!isOwner) {
            return sendSystemMessage(socket, 'error', 'addPlayer', 'You are not the owner of the game');
          }

	        if(data.playerUsername.toLowerCase() === socket.game.ownerUsername.toLowerCase()) {
            return sendSystemMessage(socket, 'error', 'addPlayer', 'You are already added to the game');
	        }

          models.Player.playerModel.findByUsername(data.playerUsername, function(err, newPlayer){

            if(err || !newPlayer){
              return sendSystemMessage(socket, 'error', 'addPlayer', 'Player could not be found');
            }

            models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(data.playerUsername, socket.game.id, function(err, permission){
              if(err) {
                return sendSystemMessage(socket, 'error', 'addPlayer', 'An error occurred adding the player to the game. Please try again.');
              }

              if(permission) {
                return sendSystemMessage(socket, 'error', 'addPlayer', 'Player is already added to the game');
              }

              var newGamePlayer = new models.Session.sessionPlayerModel({
                    sessionId: socket.game.id,
                    playerId: newPlayer.id,
                    playerUsername: newPlayer.username,
                    displayName: newPlayer.displayName
              });

              newGamePlayer.save(function(err) {
                if(err) {
                  return sendSystemMessage(socket, 'error', 'addPlayer', 'An error occurred adding the player to the game. Please try again.');
                }

                sendSystemMessage(socket, 'success', 'addPlayer', newPlayer.username + ' was added to the game');
                returnGamePlayerList(socket, true);
              });
	          });
	        });
        });
    });
 
    socket.on('removePlayer', function(data){
                
        if(!data || !data.playerUsername) {
          return sendSystemMessage(socket, 'error', 'removePlayer', 'You must specify a player to remove');
        }

        middleware.checkOwnership(socket.game.ownerUsername, socket.handshake.session.player.username, function(isOwner) {

          if(!isOwner) {
            return sendSystemMessage(socket, 'error', 'removePlayer', 'You are not the owner of the game');
          }

	        if(data.playerUsername.toLowerCase() === socket.game.ownerUsername.toLowerCase()) {
		        return sendSystemMessage(socket, 'error', 'removePlayer', 'You cannot remove yourself from your own game');
	        }

	        models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(data.playerUsername, socket.game.id, function(err, permission){
		        if(err || !permission) {
			        return sendSystemMessage(socket, 'error', 'removePlayer', 'Player is not in this game');
		        }

		        permission.remove();

            sendSystemMessage(socket, 'success', 'removePlayer', data.playerUsername + ' was removed from the game');
//            _.each(clients[socket.room][data.playerUsername], function(playerSocket) {
//              playerSocket.disconnect();
//            });
//            delete clients[socket.room][data.playerUsername];


            socketStorage.smembers("storagePlayer:" + socket.room + "/" + data.playerUsername, function (err, members) {
              _.each(members, function(playerSocket) {
                io.sockets.socket(playerSocket).disconnect();
              });

            });

            returnGamePlayerList(socket, true);
	        });
	
        });
    });

    socket.on('changePlayer', function(data){
      if(!data || !data.type) {
        return sendSystemMessage(socket, 'error', 'changePlayer', 'Type of player change is required');
      }

      switch(data.type) {
        case 'promoteGM' :
          addGM(data, socket);
          break;
        case 'demoteGM' : 
          removeGM(data, socket);
          break;
        default: 
          return sendSystemMessage(socket, 'error', 'changePlayer', 'Type of player change is unrecognized');
      }
    });

    socket.on('changeGameSettings', function(data) {
      if(!socket.room) {
        return sendSystemMessage(socket, 'error', 'changeGameSettings', 'Not connected to a game');
      }
      io.sockets.in(socket.room).except(socket.id).emit('gameSettingsChanged',data);
    });


	  /**
	   * TODO: Store in database
	   */
	  socket.on('chat', function(data) {

		  if(!socket.room) {
			  return sendSystemMessage(socket, 'error', 'chat', 'Not connected to a game');
		  }

      if(!data) {
       	return sendSystemMessage(socket, 'error', 'chat', 'A message is required');
      }

		  var newChatMessage = new models.Session.sessionChatModel({
			  sessionId: socket.game.id,
			  playerId: socket.handshake.session.player.id,
			  displayName: socket.handshake.session.player.displayName,
        message: data
		  });

		  newChatMessage.save(function(err) {
			  if(err) {
				  return sendSystemMessage(socket, 'error', 'chat', 'An error occurred while saving chat');
			  }

			  io.sockets.in(socket.room).emit('chat', {displayName: socket.handshake.session.player.displayName,message: data });
		  });
	  });

	  socket.on('saveCanvas', function(data) {
		  if(!socket.room) {
			  return sendSystemMessage(socket, 'error', 'saveCanvas', 'Not connected to a game');
		  }

		  if(!data) {
			  return sendSystemMessage(socket, 'error', 'saveCanvas', 'Could not access canvas data');
		  }

		  socket.game.canvas = data;

		  socket.game.save(function(err) {
			  if(err) {
				  socket.game.save(function(err) {
					  if(err) {
						  log.error('Failed to save canvas for ' + socket.room);
					  }
				  });
			  }
		  });
	  });

	  socket.on('objectAdded', function(data) {
		  if(!socket.room) {
			  return sendSystemMessage(socket, 'error', 'objectAdded', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectAdded',data);
    });

	  socket.on('objectModified', function(data) {
		  if(!socket.room) {
			  return sendSystemMessage(socket, 'error', 'objectModified', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectModified',data);
	  });

	  socket.on('objectRemoved', function(data) {
		  if(!socket.room) {
			  return sendSystemMessage(socket, 'error', 'objectRemoved', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectRemoved',data);
	  });

    socket.on('removeLibraryObject', function(data) {
      if(!socket.room) {
        return sendSystemMessage(socket, 'error', 'removeLibraryObject', 'Not connected to a game');
      }

      if(!data || !data.publicPath) {
        return sendSystemMessage(socket, 'error', 'removeLibraryObject', 'Public path must be specified');
      }

      models.Session.sessionLibraryModel.findByPublicPath(data.publicPath, function(err, token) {
        if(err || !token) {
          return sendSystemMessage(socket, 'error', 'removeLibraryObject', 'Failed to remove object from the game library. Please try again.');
        }

        utils.uploadModule.removeAsset(data.publicPath + config.getConfig().specialConfigs.imageSize.thumb.type, function(err, status) {

          if(err) {
              return sendSystemMessage(socket, 'error', 'removeLibraryObject', 'Failed to remove object from the game library. Please try again.');         
          }

          token.remove(function(err, token) {
            if(err) {
              return sendSystemMessage(socket, 'error', 'removeLibraryObject', 'Failed to remove object from the game library. Please try again.');
            }

            updateSessionLibrary(socket.game.id, socket.game.name + "/" + socket.game.ownerUsername);
          });

        });
      });

    });

	  socket.on('disconnect', function(data) {
	    var player = socket.handshake.session.player;
      //delete clients[socket.room][player.username];

      socketStorage.srem(socket.storageGamePlayer, socket.id);

      socketStorage.smembers(socket.storageGamePlayer, function(err, members) {
        if(!members || members.length === 0) {
          socketStorage.srem(socket.storageGameRoom, socket.storageGamePlayer);
        }
      });

		  socket.leave(socket.room);
      io.sockets.in(socket.room).emit('playerLeft',  {username: player.username, displayName: player.displayName, type: player.type});
    });
 });
};

var addGM = function(data, socket) {
  if(!data || !data.playerUsername) {
    return sendSystemMessage(socket, 'error', 'addGM', 'You must specify a username to make a GM');
  }

  middleware.checkOwnership(socket.game.ownerUsername, socket.handshake.session.player.username, function(isOwner) {

    if(!isOwner) {
      return sendSystemMessage(socket, 'error', 'addGM', 'You are not the owner of the game');
    }

    if(data.playerUsername.toLowerCase() === socket.game.ownerUsername.toLowerCase()) {
      return sendSystemMessage(socket, 'error', 'addGM', 'You are already a GM');
    }

    models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(data.playerUsername, socket.game.id, function(err, permission){
      if(err || !permission) {
        return sendSystemMessage(socket, 'error', 'addGM', 'Player could not be found in this game. Please add them to the game first.');
      }

      if(permission.isGM === true) {
        return sendSystemMessage(socket, 'error', 'addGM', 'Player is already a GM');
      }

      permission.isGM = true;

      permission.save(function(err) {
        if(err) {
	        return sendSystemMessage(socket, 'error', 'addGM', 'An error occurred adding the GM to the game. Please try again.');
        }

        sendSystemMessage(socket, 'success', 'addGM', data.playerUsername + ' has been promoted to a GM');

//        _.each(clients[socket.room][data.playerUsername], function(playerSocket) {
//          sendSystemMessage(playerSocket, 'updatePlayer', 'addGM', 'You have been promoted to a GM. Please reload the page to access your new GM abilities');
//        });

          socketStorage.smembers("storagePlayer:" + socket.room + "/" + data.playerUsername, function (err, members) {
            _.each(members, function(playerSocket) {
              sendSystemMessage(io.sockets.socket(playerSocket), 'updatePlayer', 'addGM', 'You have been promoted to a GM. Please reload the page to access your new GM abilities');
            });
          });

        returnGamePlayerList(socket, true);
      });
    });
  });
};

var removeGM = function(data, socket) {
  if(!data || !data.playerUsername) {
    return sendSystemMessage(socket, 'error', 'removeGM', 'You must specify a username to remove as a GM');
  }

  middleware.checkOwnership(socket.game.ownerUsername, socket.handshake.session.player.username, function(isOwner) {

    if(!isOwner) {
      return sendSystemMessage(socket, 'error', 'removeGM', 'You are not the owner of the game');
    }

    if(data.playerUsername.toLowerCase() === socket.game.ownerUsername.toLowerCase()) {
      return sendSystemMessage(socket, 'error', 'removeGM', 'You cannot remove yourself as a GM');
    }

    models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(data.playerUsername, socket.game.id, function(err, permission){
      if(err || !permission) {
        return sendSystemMessage(socket, 'error', 'removeGM', 'Player could not be found in this game. Please add them to the game first.');
      }

      if(permission.isGM === false) {
        return sendSystemMessage(socket, 'error', 'removeGM', 'Player is not currently a GM');
      }

      permission.isGM = false;

      permission.save(function(err) {
        if(err) {
	        return sendSystemMessage(socket, 'error', 'removeGM', 'An error occurred removing the GM from the game. Please try again');
        }

        sendSystemMessage(socket, 'success', 'removeGM', data.playerUsername + ' has been made into a normal player');

//        _.each(clients[socket.room][data.playerUsername], function(playerSocket) {
//          sendSystemMessage(playerSocket, 'updatePlayer', 'removeGM', 'You have been made into a normal player. Please reload the page to access your new abilities');
//        });

          socketStorage.smembers("storagePlayer:" + socket.room + "/" + data.playerUsername, function (err, members) {
            _.each(members, function(playerSocket) {
              sendSystemMessage(io.sockets.socket(playerSocket), 'updatePlayer', 'removeGM', 'You have been made into a normal player. Please reload the page to access your new abilities');
            });
          });

        returnGamePlayerList(socket, true);
      });
    });
  });
};

var sendSystemMessage = function(socket, type, action, message) {
  socket.emit('systemMessage', { type: type, action: action, message: message} );
}

var sendRoomSystemMessage = function(room, type, action, message) {
  io.sockets.in(room).emit('systemMessage', { type: type, action: action, message: message} );
}

var returnGamePlayerList = function(socket, broadcast){
  models.Session.sessionPlayerModel.findGamePlayers(socket.game.id, function(err, players){
    if(err) {
      return sendSystemMessage(socket, 'error', 'playerManageList', 'Could not find players for this game');
    }

    if(!players) {
      return socket.emit('playerManageList', {});
    }

    if(broadcast) {
      return io.sockets.in(socket.room).emit('playerManageList', _.pluck(players, 'clientObject'));
    }
    
    socket.emit('playerManageList', _.pluck(players, 'clientObject'));
  });
}

var updateSessionLibrary = function(gameId, room) {

  models.Session.sessionLibraryModel.findLibrary(gameId, function(err, data) {

    if(err) {
      return sendRoomSystemMessage(room, 'error', 'sessionLibraryUpdate', 'Game Object Library could not be loaded');
    }

    io.sockets.in(room).emit('sessionLibraryUpdate', _.pluck(data, 'clientObject'));

  });

}

module.exports.configureSockets = configureSockets;
module.exports.updateSessionLibrary = updateSessionLibrary;
