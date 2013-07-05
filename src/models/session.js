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

    
var mongoose = require ("mongoose"); 
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
var xxhash = require('xxhash');
var _ = require('underscore');
var utils = require('../utils');
var config = require('../config.js');
var player = require('./player.js');
var log = config.getLogger();

var setName = function(name) {
	return _.escape(name).trim();
}

var SessionSchema = new mongoose.Schema({
  owner: 	{
		type: Schema.ObjectId,
		required: true,
		ref: 'Players'
	},
  ownerUsername: {
		type: String,
		required: true,
		trim: true
	},
  ownerDisplayName : {
    type: String,
    required: true,
    trim: true
  },
  name:		{
		type: String,
		required: true,
		trim: true,
    match: /^[a-z0-9\s]+$/i
	},
  canvas: {
		type: String
	}

});

SessionSchema.index({ owner: 1, name: 1 }, { unique: true });

var SessionPlayerSchema = new mongoose.Schema({
  sessionId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'sessions'
  },
  playerId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'Players'
	},
  playerUsername: {
    type: String,
    required: true
  },
  isGM: {
    type: Boolean,
    required: true,
    'default': false
  }
 
});
SessionPlayerSchema.index({ sessionId: 1, playerId: 1 }, { unique: true });

var SessionLibrarySchema = new mongoose.Schema({
  sessionId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'sessions'
	},
  playerId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'Players'
	},
  name:		{
		type: String,
		required: true,
		trim: true
	},  
  type:		{
		type: String,
		required: true,
		trim: true
	},  
  publicPath:   {
		type: String,
		required: true,
		trim: true
  }
 
});
SessionLibrarySchema.index({ publicPath: 1 }, { unique: true });

var SessionChatSchema = new mongoose.Schema({
  sessionId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'sessions'
	},
  playerId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'Players'
	},
  time: 	{	
    type: Date,
    'default': Date.now
	},
  message: {
    type: String,
    required: true
  }
  
});

var SessionLogSchema = new mongoose.Schema({
  sessionId:	{
		type: Schema.ObjectId,
		required: true,
		ref: 'sessions'
	},
  events: 	[
		{
			type: String,
			time: {	
					type: Date,
					'default': Date.now
    	},
			data: String
		}
	]

});

SessionSchema.statics.findByNameOwner = function(name, owner, callback) {
	return SessionModel.findOne(
	{
		name: new RegExp('^' + name + '$', 'i'),
		ownerUsername: owner
	}, callback);
};

SessionPlayerSchema.virtual('clientObject').get(function() {
  return {
    "playerUsername": this.playerId.username,
    "displayName": this.playerId.displayName,
    "isGM": this.isGM
  }
});

SessionPlayerSchema.statics.findGamePlayers = function(sessionId, callback) {
  SessionPlayerModel.find(
  {
    sessionId: sessionId
  }).populate('playerId', 'username displayName').exec(callback);
}

SessionPlayerSchema.statics.findPlayerGamePermissionById = function(playerId, sessionId, callback) {
	return SessionPlayerModel.findOne(
	{
		sessionId: sessionId,	
		playerId: playerId
	}, callback );
};

SessionPlayerSchema.statics.findPlayerGamePermissionByUsername = function(playerUsername, sessionId, callback) {
  SessionPlayerModel.findOne(
	{
		sessionId: sessionId,	
		playerUsername: playerUsername
	}, callback );
};

SessionLibrarySchema.virtual('clientObject').get(function() {
	return {
    'publicPath': this.publicPath,
		'url': config.getConfig().specialConfigs.awsUrl + this.publicPath,
		'thumbnail': config.getConfig().specialConfigs.awsUrl + this.publicPath + config.getConfig().specialConfigs.imageSize.thumb.type,
		'type': this.type,
		'name': this.name,
    'ownerDisplayName': this.playerId.displayName,
    'owner': this.playerId.username
        }
});

SessionLibrarySchema.statics.findByPublicPath = function(publicPath, callback) {
	return SessionLibraryModel.findOne(
	{
		publicPath: publicPath
	}, callback );      
};

SessionLibrarySchema.statics.findLibrary = function(sessionId, callback) {
	return SessionLibraryModel.find(
	{
		sessionId: sessionId
	}).populate('playerId', 'username displayName').find(callback);      
};


SessionChatSchema.virtual('clientObject').get(function() {
  return {
    'message': this.message,
    'username': this.playerId.username,
    'displayName': this.playerId.displayName
  }
});

SessionChatSchema.statics.findHistory = function(sessionId, callback) {
	return SessionChatModel.find(
	{
		sessionId: sessionId
	}).populate('playerId').find(callback);
};

var SessionModel = mongoose.model('Session', SessionSchema);
var SessionPlayerModel = mongoose.model('SessionPlayers', SessionPlayerSchema);
var SessionLibraryModel = mongoose.model('SessionLibrary', SessionLibrarySchema);
var SessionChatModel = mongoose.model('SessionChat', SessionChatSchema);
var SessionLogModel = mongoose.model('SessionLog', SessionLogSchema);
module.exports.sessionModel = SessionModel;
module.exports.sessionPlayerModel = SessionPlayerModel;
module.exports.sessionLibraryModel = SessionLibraryModel;
module.exports.sessionChatModel = SessionChatModel;
module.exports.sessionLogModel = SessionLogModel;
module.exports.sessionSchema = SessionSchema;
module.exports.sessionPlayerSchema = SessionPlayerSchema;
module.exports.sessionLibrarySchema = SessionLibrarySchema;
module.exports.sessionChatSchema = SessionChatSchema;
module.exports.sessionLogSchema = SessionLogSchema;

