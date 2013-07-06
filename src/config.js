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

var fs = require('fs');

var logger;
var environment = 'development'; 
//Default secret key is the sha 512 sum of driftwoodrp
var secretKey = '970fa453de9e7e9598096e52296b3bc18c782a7491056a7bd9e027b219173aa9c46fa7a3cefdd12ee6a017c8f84ea25275be5b996b0cc5c2c1cedc64f86465fb'; 
var port = 3000;
var url = "http://127.0.0.1";
var databaseURI = 'mongodb://localhost/Driftwood';
var liveUrl = 'http//127.0.0.1:3000';
var specialConfigs = {};

var contents = fs.readFileSync(__dirname + '/secrets.json', 'utf8');

if(!contents) {
	console.log('Secret file was not found, falling back to default key');
}
else{
	var keys = JSON.parse(contents);
	secretKey = keys.secret;
}

contents = fs.readFileSync(__dirname + '/config.json', 'utf8');

if(!contents) {
	console.log('Config file was not found, falling back onto defaults');
}
else{
	var configData = JSON.parse(contents);
	environment = configData.environment;
	port = configData.port; 
        url = configData.url;
	databaseURI = configData.databaseURI;

        if(!environment || !port || !url || !databaseURI || !configData.liveUrl) {
 	  console.log("ERROR: MISSING CONFIGURATION DATA, SHUTTING DOWN!");
          process.exit(5);
        }

        if(environment === 'production' ) {
          liveUrl = configData.liveUrl;
        } else {
	  liveUrl = url + ':' + port;
        }
}

var files = fs.readdirSync(__dirname + '/configs');

if(files) {
        var jsonExt = new RegExp(/\.(json)$/i);

  	for(var i = 0; i < files.length; i++) {
	    if(jsonExt.test(files[i])) {
		  contents = fs.readFileSync(__dirname + '/configs/' + files[i]);
		  if(!contents) {
		    console.log("Config file " + files[i] + " could not be read");
		  } 
		  else {
		    var configData = JSON.parse(contents);
	 
	 	    for(var k in configData) {
			specialConfigs[k] = configData[k];
		    }
 
                    console.log('Loaded config ' + files[i]);
		  }
	    } 
            else {
 	       	console.log('Ignoring non-json config file ' + files[i]);
            }
 	}
}

var tutorial = fs.readFileSync(__dirname + '/tutorialdata', 'utf8');

if(!tutorial) {
  tutorial = "";
}

var tos = fs.readFileSync(__dirname + '/../assets/policy/tos.txt');

if (!tos) {
  process.exit(5);
}

var getLogger = function(){
	if(!logger){
		var now = new Date();
		var logConfig = "/tmp/driftwood" + now.getDate() + "" + (now.getMonth()+1) + "" + now.getYear() + ".log" ;

		var winston = require('winston');
		var transports = [new winston.transports.Console()];
		transports.push(new winston.transports.File({
			filename: logConfig
		}));

		logger = new (winston.Logger)({ 
			transports: transports 
		});
	}

	return logger;
};

var getConfig = function(){
	return {
		environment: environment,
                secretKey: secretKey,
		port: port,
                url: url,
		liveUrl: liveUrl,
		databaseURI: databaseURI,
                specialConfigs: specialConfigs,
    tutorial: tutorial,
    tos: tos
	};
};

module.exports.getLogger = getLogger;
module.exports.getConfig = getConfig;



