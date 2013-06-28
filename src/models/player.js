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
var _ = require('underscore');
var config = require('../config.js');
var log = config.getLogger();

var playerModel;

var encodePassword = function(password) {
	return bcrypt.hashSync(password, 8);
};

var setName = function(name) {
	return _.escape(name).trim();
}

var PlayerSchema = new mongoose.Schema({
  username: 	{
              		type: String,
			required: true,
			trim: true,
 			match: /^[A-Za-z0-9_\-\.]{1,16}$/,
			unique: true
	    	},
  password: 	{
		   	type: String,
			required: true,
			set: encodePassword	
  	    	},
  name:     	{
    			first: { type: String, trim: true, set: setName },
    			last: { type: String, trim: true, set: setName },
                        displayName: { type: String, trim: true, set: setName }
           	},
  email:   	{
			type: String,
			trim: true,
			required: true,
			match: /^[A-Za-z0-9_\-\.\+]+@[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]{2,4}$/
           	},
  createdDate:  {
			type: Date,
			'default': Date.now
	       	},
  lastLogin:   	{
			type: Date,
			'default': Date.now
	      	}
});

PlayerSchema.methods.api = function() {
	return {
		id: this._id,
		username: this.username,
		displayName: this.name.displayName
	};

};

PlayerSchema.methods.validatePassword = function(password) {
	return bcrypt.compareSync(password, this.password);
};

PlayerSchema.statics.findPlayersByIds = function(playerIds, callback) {
  return PlayerModel.find( 
  {
    _id: {$in: playerIds}
  }, callback);
};

PlayerSchema.statics.findByUsername = function(user, callback) {
	return PlayerModel.findOne(
	{
		username: new RegExp('^' + user.trim() + '$', 'i')
	}, callback);
};

PlayerSchema.statics.findByEmail = function(email, callback) {
	return PlayerModel.findOne(
        {
		email: new RegExp('^' + email.trim() + '$', 'i')
	}, callback);
};

PlayerSchema.statics.authenticate = function(username, password, callback) {
	return PlayerModel.findByUsername(username, function(err, doc) {
		if(err)
		{
			callback(err);
		}	

		if(doc && doc.validatePassword(password)) {
			return callback(null, doc);
		}

		return callback();
	});
};

PlayerModel = mongoose.model('Players', PlayerSchema);
module.exports.playerModel = PlayerModel;
module.exports.playerSchema = PlayerSchema;




