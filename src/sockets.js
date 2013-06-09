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
var config = require('./config.js');
var log = config.getLogger();

var io;

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
				});

				socket.join(data.gameName + "/" + data.owner);

				socket.room = data.gameName + "/" + data.owner;

                                socket.game = game;

				models.Session.sessionChatModel.find({
					sessionId: game.id
				}, { _id: 0, __v: 0, sessionId: 0, playerId: 0 }).sort({'_id': -1}).find(function(err, doc){
					var chatSession;

                                        if(err) {
                                          chatSession = [{ displayName: "System", message: "Previous chats could not be loaded" }];
                                        } else {
                                          chatSession = doc;
                                        }

		                        //FIXME: Don't send the session player, we need to send all player information
					//that the game will need. Username, player settings, user type (gm|player)

					var player = socket.handshake.session.player.username;
					socket.emit('joined', { username: player.username, displayName: player.displayName, chatSession: chatSession } );
                                });     

			});

		});

		/**
		 * TODO: Store in database
		 */
		socket.on('chat', function(data) {

			if(!socket.room) {
				socket.emit('error', 'Not connected to a game');
			}

                        if(!data) {
                         	socket.emit('error', 'A message is required');
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
					socket.emit('error', 'An error occurred while saving chat');
				}

				io.sockets.in(socket.room).emit('chat', {username: socket.handshake.session.player.displayName,message: message });
			});
		});

		socket.on('disconnect', function(data) {
			socket.leave(socket.room);
		});
     });
};

var updateSessionLibrary = function(room, message) {
  io.sockets.in(room).emit('sessionLibraryUpdate', message);
}


module.exports.configureSockets = configureSockets;
module.exports.updateSessionLibrary = updateSessionLibrary;
