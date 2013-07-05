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


var models = require('../models');
var async = require('async');
require('async-rollback');
var fs = require('fs');
var mongoose = require ("mongoose"); 
var Schema = mongoose.Schema;
var config = require('../config.js');
var xxhash = require('xxhash');
var log = config.getLogger();
var utils = require('../utils');
var sockets = require('../sockets.js');
var url = config.getConfig().liveUrl;

var colorRegex = new RegExp(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

var gridPage = function(req, res) {
  
  var color = req.query.color;
  var size = req.query.size;

  if(!color || !colorRegex.test(color)) {
    color = '#777777';
  }

  if(!size || isNaN(size) || !isFinite(size)) {
    size = 80;
  }
  res.contentType('image/svg+xml');
  res.render('grid', { color: color, size: size});
};

var joinSessionPage = function(req, res) {
	var player = res.locals.player;
	var conditions = {
		playerId: player.id
	}
	
	models.Session.sessionPlayerModel.find(conditions).exec(function(err, docs) {
		var ids = docs.map(function(doc) { return doc.sessionId; });

		models.Session.sessionModel.find({_id: {$in: ids}}).sort('name').exec(function(err, games) {
			res.render('lobby2', {title: 'Lobby', games: games});
		});
	});
};

var createSession = function(req, res){
	var player = res.locals.player;
	var gameName = req.body.name;
	
	if(!gameName || !player) {
		return res.badRequest("Game Name is required");
	}

	models.Session.sessionModel.findByNameOwner(gameName, player.username, function(err, doc) {
		if(err) {
			return res.err('An error occurred creating the game. Please try again.');
		}

		if(doc)
		{
			return res.conflict('You already have a game with the same name');
		}

		// Creating one game.
		var newGame = new models.Session.sessionModel({
		  owner: player.id,
		  ownerUsername: player.username,
      ownerDisplayName: player.displayName,
		  name: gameName
		});

		// Saving it to the database.  
		newGame.save(function(err) {
			if(err) {
          console.log(err);
			  return res.err('An error occurred creating the game. Please try again.');
			}

			var gameId = newGame.id;	

			var newGamePlayer = new models.Session.sessionPlayerModel({
				sessionId: gameId,
				playerId: player.id,
        playerUsername: player.username,
        isGM: true
			});

			newGamePlayer.save(function(err) {
				if(err) {
					return res.err('An error occurred adding you to the game. Please try again');
				}

				res.redirect('/joinGame/' + player.username);
			});
		});
		
	});
};

var loadSession = function(req, res) {
	var game = res.locals.game;

	res.render('game2', {url: url, title: game.name, game: game});
};

var addPlayer = function(req, res) {
	var playerUsername = req.body.username;
	var game = res.locals.game;
	
	if(!playerUsername) {
		return res.badRequest("A player's username is required");
	}

	if(playerUsername.toLowerCase() === game.ownerUsername.toLowerCase()) {
		return res.badRequest("You are already added to the game");
	}

	models.Player.playerModel.findByUsername(playerUsername, function(err, newPlayer){

		if(err || !newPlayer){
			return res.notFound("Player could not be found");
		}

	  models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(playerUsername, game.id, function(err, permission){
		  if(err) {
				return res.err('An error occurred adding the player to the game. Please try again.');
		  }

		  if(permission) {
			  return res.err("Player is already added to the game");
		  }

		  var newGamePlayer = new models.Session.sessionPlayerModel({
			  sessionId: game.id,
			  playerId: newPlayer.id
		  });

		  newGamePlayer.save(function(err) {
			  if(err) {
				  return res.err('An error occurred adding the player to the game. Please try again.');
			  }

			  res.created(newPlayer.username + " was added to the game");
		  });
    });
	});
};

var removePlayer = function(req, res) {
	var playerUsername = req.body.username;
	var game = res.locals.game;
	
	if(!playerUsername) {
		return res.badRequest("A player's username is required");
	}

	if(playerUsername.toLowerCase() === game.ownerUsername.toLowerCase()) {
		return res.badRequest("You cannot remove yourself from your own game");
	}

	models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(playerUsername, game.id, function(err, permission){
		if(err) {
			log.error(err);
			return res.forbidden("Player could not be found in this game");
		}

		if(!permission) {
			return res.forbidden("Player has not been added to the game. Please add them to the game first.");
		}

		permission.remove();

		res.updated(playerUsername + " was removed from the game");
	});
};

var addGM = function(req, res) {
	var playerUsername = req.body.username;
	var game = res.locals.game;
	
	if(!playerUsername) {
		return res.badRequest("A player's username is required");
	}

	if(playerUsername.toLowerCase() === game.ownerUsername.toLowerCase()) {
		return res.badRequest("You are already a GM");
	}


	models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(playerUsername, game.id, function(err, player) {

		if(err) {
			return res.err('An error occurred adding the GM to the game. Please try again.');
		}

		if(!player) {
			return res.err('Player could not be found in this game. Please add them to the game first.');
		}

		if(player.isGM === true) {
			return res.err('Player is already a GM');
		}

		player.isGM = true;

		player.save(function(err) {
			if(err) {
				return res.err('An error occurred adding the GM to the game. Please try again.');
			}

			res.created(playerUsername + " has been promoted to a GM");
		});
	});

};

var removeGM = function(req, res) {
	var playerUsername = req.body.username;
	var game = res.locals.game;
	
	if(!playerUsername) {
		return res.badRequest("A player's username is required");
	}

	if(playerUsername.toLowerCase() === game.ownerUsername.toLowerCase()) {
		return res.badRequest("You cannot remove yourself as a GM");
	}

	models.Session.sessionPlayerModel.findPlayerGamePermissionByUsername(playerUsername, game.id, function(err, player) {

		if(err) {
			return res.err('An error occurred removing the GM from the game. Please try again');
		}

		if(!player) {
			return res.err('Player could not be found in this game. Please add them to the game first');
		}

    if(player.isGM === false) {
		  	return res.err('Player is not currently a GM');
    }

		player.isGM = false;

		player.save(function(err) {
			if(err) {
				return res.err('An error occurred removing the GM from the game. Please try again');
			}

			res.created(playerUsername + " has been made into a normal player");
		});
	});
};

var uploadToken = function(req, res) {

        if(!(req.files && req.files.assetFile && req.body.type)){
	  return res.badRequest('Only valid image formats are accepted');
        }

        var date = new Date();
 	var publicPath = date.getMilliseconds();
        publicPath = publicPath + '' + xxhash.hash(new Buffer(req.session.player.id), 0xCEADBF78);
        publicPath = publicPath + '' + xxhash.hash(new Buffer(res.locals.game.id), 0xCEADBF78);
        publicPath = publicPath + '' + xxhash.hash(new Buffer(req.files.assetFile.name), 0xCEADBF78);

        var newToken = new models.Session.sessionLibraryModel({
          sessionId: res.locals.game.id,
          playerId: req.session.player.id,
          name: req.files.assetFile.name,
          type: req.body.type,
          publicPath: publicPath
        });

        newToken.save(function(err) {
          if(err) {
            return res.err('Token failed to upload, please try again');
          }

           async.parallelRollback({
             main: {
               do: function(asyncCallback) { 
                 utils.uploadModule.uploadAsset(req.files.assetFile, publicPath, asyncCallback);
               },
               undo: function(result, asyncCallback) {
                 utils.uploadModule.removeAsset(publicPath, asyncCallback);
               }
	    },/////
             thumb: {
               do: function(asyncCallback) { 
                 var thumb = new utils.imageModule.Image(req.files.assetFile.path);
		 thumb.resize(config.getConfig().specialConfigs.imageSize.thumb, function(err){
		   if(err) {
		     return asyncCallback(err);
		   }

		   thumb.uploadStream(publicPath + config.getConfig().specialConfigs.imageSize.thumb.type, asyncCallback); 
		 });
               },
               undo: function(result, asyncCallback) {
                 utils.uploadModule.removeAsset(publicPath + config.getConfig().specialConfigs.imageSize.thumb.type, asyncCallback); 
               }
             } 
           }, function(err, results) { 
              if(err) {
                newToken.remove(function(err) {
                  if(err) {
                   log.error('Failed to remove session library token ' + publicPath);
                  }
	        });

                return res.err(err);  
               }

               sockets.updateSessionLibrary(res.locals.game.id, res.locals.game.name + "/" + res.locals.game.ownerUsername);

              
               res.json({
                          'url': config.getConfig().specialConfigs.awsUrl + publicPath,
                          'thumbnail': config.getConfig().specialConfigs.awsUrl + publicPath + config.getConfig().specialConfigs.imageSize.thumb.type,
                          'type': req.body.type,
                          'name': req.files.assetFile.name
                       });     
    
           });
        });
};


var removeToken = function(req, res) {
	if(!req.body.assetFile){
	  return res.badRequest('The token to remove was not specified');
        }

        models.Session.sessionLibraryModel.findByPublicPath(req.body.assetFile, function(err, doc){
          if(err || !doc){
	    return res.notFound("Token was not found in the game library");
          }

          utils.uploadModule.removeAsset(req.body.assetFile, function(err, status) {
             
            if(err) {
              res.json('Token was not removed from the game library. Please try again.');
            }

            res.json('Token was removed from the game library');
	  });
       });

};

module.exports.gridPage = gridPage;
module.exports.joinSessionPage = joinSessionPage;
module.exports.createSession = createSession;
module.exports.loadSession = loadSession;
module.exports.addPlayer = addPlayer;
module.exports.removePlayer = removePlayer;
module.exports.addGM = addGM;
module.exports.removeGM = removeGM;
module.exports.uploadToken = uploadToken;
module.exports.removeToken = removeToken;

