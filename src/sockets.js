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
var log = config.getLogger();

var io;

var clients = {};

var configureSockets = function(socketio) {
  io = socketio;
  io.sockets.on('connection', function(socket) {

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
      	          chatHistory = chats;
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

              if(!clients[socket.room]) {
                clients[socket.room] = {};
              } 
               
              if(!clients[socket.room][player.username]) {
                clients[socket.room][player.username] = [];
              }

              clients[socket.room][player.username].push(socket);
              
              io.sockets.in(socket.room).emit('playerJoined', { user: {username: player.username, displayName: player.displayName, type: player.type} });

						  socket.emit('joined', { user: {username: player.username, displayName: player.displayName, type: player.type, isOwner: player.isOwner}, 
                                      chatSession: chatHistory, 
                                      objectLibrary: objectLibrary, 
                                      canvas: game.canvas } );
					  }
				  );
					
			  });  

		  });

	  });
 
    socket.on('removePlayer', function(data){
        
        middleware.checkOwnership(socket.game.ownerUsername, socket.handshake.session.player.username, function(isOwner) {

          if(!isOwner) {
            return socket.emit('error', 'You are not the owner of the game');
          }

          _.each(clients[socket.room]['new'], function(playerSocket) {
            playerSocket.disconnect();
          });
          delete clients[socket.room]['new'];


        });
    });


	  /**
	   * TODO: Store in database
	   */
	  socket.on('chat', function(data) {

		  if(!socket.room) {
			  return socket.emit('error', 'Not connected to a game');
		  }

      if(!data) {
       	return socket.emit('error', 'A message is required');
      }

		  var message = _.escape(data); 


		  var newChatMessage = new models.Session.sessionChatModel({
			  sessionId: socket.game.id,
			  playerId: socket.handshake.session.player.id,
			  displayName: socket.handshake.session.player.displayName,
        message: message
		  });

		  newChatMessage.save(function(err) {
			  if(err) {
				  return socket.emit('error', 'An error occurred while saving chat');
			  }

			  io.sockets.in(socket.room).emit('chat', {displayName: socket.handshake.session.player.displayName,message: message });
		  });
	  });

	  socket.on('saveCanvas', function(data) {
		  if(!socket.room) {
			  return socket.emit('error', 'Not connected to a game');
		  }

		  if(!data) {
			  return socket.emit('error', 'Could not access canvas data');
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
			  return socket.emit('error', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectAdded',data);
    });

	  socket.on('objectModified', function(data) {
		  if(!socket.room) {
			  return socket.emit('error', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectModified',data);
	  });

	  socket.on('objectRemoved', function(data) {
		  if(!socket.room) {
			  return socket.emit('error', 'Not connected to a game');
		  }
		  io.sockets.in(socket.room).except(socket.id).emit('objectRemoved',data);
	  });

	  socket.on('disconnect', function(data) {
      delete clients[socket.room][socket.handshake.session.player.username];

		  socket.leave(socket.room);
      io.sockets.in(socket.room).emit('playerLeft', socket.handshake.session.player.username);
    });
 });
};

var updateSessionLibrary = function(room, message) {
  io.sockets.in(room).emit('sessionLibraryUpdate', message);
}

module.exports.configureSockets = configureSockets;
module.exports.updateSessionLibrary = updateSessionLibrary;
