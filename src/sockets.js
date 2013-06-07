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
var controllers = require('./controllers');
var _ = require('underscore');

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

				//FIXME: Don't send the session player, we need to send all player information
				//that the game will need. Username, player settings, user type (gm|player)
				socket.emit('joined', socket.handshake.session.player);
			});

		});

		/**
		 * TODO: Store in database
		 * TODO: Clean up chat (sanitize html, turn newlines into breaks, etc)
		 * TODO: Send proper data object, right now the front end is looking
		 * for username and message. Maybe we change the template on the front
		 * end to just accept a message and we do the username: message stuff
		 * with a template on this end. This way we can output messages to the
		 * chat that DONT have a username: message
		 */
		socket.on('chat', function(data) {

			if(!socket.room) {
				socket.emit('error', 'Not connected to a game');
			}
			//How do I get the user's name?
			io.sockets.in(socket.room).emit('chat', {username: socket.handshake.session.player.username,message: _.escape(data) });
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
