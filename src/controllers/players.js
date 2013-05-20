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
var fs = require('fs');
var moniker = require('moniker');
var config = require('../config.js');
var utils = require('../utils');
var log = config.getLogger();

var createPlayer = function(newUser, pass, firstNm, lastNm, emailAddr, callback) 
{
	log.info('creating player ' + newUser);
	// Creating one user.
	var newPlayer = new models.Player.playerModel({
	  username: newUser,
	  password: pass,
	  name: 	{
				first: firstNm,
				last: lastNm
			},
	  email:   	emailAddr
	});

	// Saving it to the database.  
	newPlayer.save(function(err) {
		if(err) {
			return callback(err);
		}

		callback();
	});
};

var login = function(req, res){
	var username = req.body.loginUsername;
	var password = req.body.loginPassword;
	if(!username || !password) {
		return res.badRequest("all fields required");
	}
	
	models.Player.playerModel.authenticate(username, password, function(err, player) {
		if(err) {
			return res.json("failed to login");
		}

		if(!player) {
			return res.json("bad credentials");
		}

		req.session.player = player.api();
		res.redirect('/joinGame/' + req.session.player.username);
	});
};

var logout = function(req, res){
	req.session.destroy();
	res.redirect('/');
};

var loginPage = function(req, res){
	res.render('login', {title: 'Driftwood Login'});
};

var createAccount = function(req, res){
	var username = req.body.registerUsername;
	var password = req.body.registerPassword;
	var emailAddr = req.body.registerEmailAddr;
	var firstNm = req.body.registerFirstname;
	var lastNm = req.body.registerLastname;
	
	if(!username || !password || !emailAddr || !firstNm || !lastNm) {
		return res.badRequest("All fields required");
	}

	models.Player.playerModel.findByUsername(username, function(err, doc) {
		if(err) {
			return res.err('an error occurred creating a user');
		}

		if(doc)
		{
			return res.conflict('username is taken');
		}

		log.info('creating player ' + username);
		// Creating one user.
		var newPlayer = new models.Player.playerModel({
		  username: username,
		  password: password,
		  name: 	{
					first: firstNm,
					last: lastNm
				},
		  email:   	emailAddr
		});

		// Saving it to the database.  
		newPlayer.save(function(err) {
			if(err) {
				return res.err('an error occurred creating a user');
			}

                        utils.mailHandler.sendMail(emailAddr, 'Welcome to DriftwoodRP', 'Your account has successfully be created. Thank you for joining!');

			res.created('user created');
		});
		
	});
};

var resetPassword = function(req, res){
	var email = req.body.email;
	if(!email) {
	  return res.badRequest('email required');
  	}

        models.Player.playerModel.findByEmail(email, function(err, player) {
	  if(err) {
	    return res.err(err);
          }

          if (!player) {
            return res.notFound("A user with the email address " + email + " was not found"); 
          } 

	  var newPassword = moniker.choose();
	  player.password = newPassword;
	  player.save(function(err) {
            if(err) {
              return res.err(err);
            }
            
            utils.mailHandler.sendMail(email, 'DriftwoodRP Password Reset', 'Password was temporarily reset to ' + newPassword + '  . Please login and change your password');

            res.updated("Password was reset. Please check your email for your temporary password");
          });
        });
};

var changePassword = function(req, res) {
	var currentPass = req.body.currentPass;
	var newPass = req.body.newPass;

	if(!currentPass || !newPass) {
	  return res.badRequest("Current and new passwords are required");
	}

        models.Player.playerModel.findByUsername(req.session.player.username, function(err, player) {
	  if(err) {
	    return res.err(err);
          }

          if(!player) {
	    return res.notFound("Player was not found");
          }

          if(!player.validatePassword(currentPass)) {
            return res.unauthorized("Bad credentials");
          }

          player.password = newPass;
	  player.save(function(err) {
            if(err) {
              return res.err(err);
            }
            
            res.updated("Password was updated");
          });
          
	});
};


module.exports.createPlayer = createPlayer;
module.exports.loginPage = loginPage;
module.exports.login = login;
module.exports.logout = logout;
module.exports.createAccount = createAccount;
module.exports.changePassword = changePassword;
module.exports.resetPassword = resetPassword;
