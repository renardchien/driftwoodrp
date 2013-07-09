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
var fs = require('fs');
var moniker = require('moniker');
var config = require('../config.js');
var utils = require('../utils');
var log = config.getLogger();

var createPlayer = function(newUser, pass, displayName, emailAddr, callback) 
{
	log.info('creating player ' + newUser);
	// Creating one user.
	var newPlayer = new models.Player.playerModel({
	  username: newUser,
	  password: pass,
		displayName: displayName,
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
		return res.badRequest("All Fields Required");
	}
	
	models.Player.playerModel.authenticate(username, password, function(err, player) {
		if(err) {
			return res.badRequest("Failed to login. Please try again");
		}

		if(!player) {
			return res.badRequest("Bad Username or Password");
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
	res.render('signin', {title: 'Driftwood Login'});
};

var registerPage = function(req, res){
	res.render('register', {title: 'Driftwood Registration'});
};

var resetPasswordPage = function(req, res){
	res.render('reset-password', {title: 'Driftwood Password Reset'});
};

var changePasswordPage = function(req, res){
  res.render('password-change', {title: 'Driftwood Change Password'});
};

var acceptTerms = function(req, res) {
  var redirect = req.body.redirect;

  if(!redirect || redirect === "") {
    redirect = "/";
  }

  req.session.tosAgreement = true;

  res.redirect(redirect);
};

var termsConditions = function(req, res) {
  res.render('terms2', {tos: config.getConfig().tos});
};

var termsPage = function(req, res, redirect) {
  res.render('terms', {redirect: redirect, tos: config.getConfig().tos});
};

var termsRedirect = function(req, res) {
  termsPage(req, res, '/');
};

var registerTermsPage = function(req, res) {
  termsPage(req, res, '/createAccount');
};

var createAccount = function(req, res){
	var username = req.body.username;
	var password = req.body.password;
  var confirmPassword = req.body.confirmPassword;
	var emailAddr = req.body.email;
  var confirmEmail = req.body.confirmEmail;
	var displayName = req.body.displayName;
  var tosAgreement = req.body.tosAgreement;
	
	if(!username || !password || !confirmPassword || !emailAddr || !confirmEmail || !displayName) {
		return res.badRequest("All fields required");
	}

  if(!tosAgreement) {
    return res.badRequest("You must agree to the terms of service &amp; privacy policy");
  }
  
  if(password !== confirmPassword) {
    return res.badRequest("Passwords must match");
  }

  if(emailAddr !== confirmEmail) {
    return res.badRequest("Email addresses must match");
  }

	models.Player.playerModel.findByUsername(username, function(err, doc) {
		if(err) {
			return res.err('An error occurred creating the account. Please try again.');
		}

		if(doc)
		{
			return res.conflict('Username is taken');
		}

		// Creating one user.
		var newPlayer = new models.Player.playerModel({
		  username: username,
		  password: password,
		  displayName: displayName,
		  email:   	emailAddr
		});

		// Saving it to the database.  
		newPlayer.save(function(err) {
			if(err) {
				return res.err('An error occurred creating the account. Please try again.');
			}

      utils.mailHandler.sendMail(emailAddr, 'Welcome to DriftwoodRP', 'Your account has successfully been created. Thank you for joining!');

		  req.session.player = newPlayer.api();
			res.created('User was created successfully!');
		});
		
	});
};

var resetPassword = function(req, res){
	var email = req.body.email;
	if(!email) {
	  return res.badRequest('Email is required');
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
      return res.unauthorized("Current Password was Invalid");
    }

    player.password = newPass;

    player.save(function(err) {
      if(err) {
        return res.err(err);
      }
      
      res.updated("Password was updated successfully!");
    });      
	});
};

module.exports.createPlayer = createPlayer;
module.exports.loginPage = loginPage;
module.exports.login = login;
module.exports.logout = logout;
module.exports.createAccount = createAccount;
module.exports.changePassword = changePassword;
module.exports.changePasswordPage = changePasswordPage;
module.exports.resetPassword = resetPassword;
module.exports.resetPasswordPage = resetPasswordPage;
module.exports.registerPage = registerPage;
module.exports.registerTermsPage = registerTermsPage;
module.exports.termsRedirect = termsRedirect;
module.exports.acceptTerms = acceptTerms;
module.exports.termsConditions = termsConditions;
