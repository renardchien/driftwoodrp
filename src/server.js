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

var http = require ('http');	     
var express = require("express");
var mongoose = require("mongoose");
var RedisStore = require('connect-redis')(express); 
var sessionStore = new RedisStore();
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
var models = require('./models');
var controllers = require('./controllers');
var config = require('./config.js');
var log = config.getLogger();
var middleware = require('./middleware');
var middlewareHandlers = middleware.attachHandlers(config);
var router = require('./router.js');
var connect = require('connect');
var cookie = require('cookie');
var Session = connect.middleware.session.Session;
var compass = require('node-compass');

log.info("Initializing");


// Makes connection asynchronously.  Mongoose will queue up database
// operations and release them when the connection is complete.
mongoose.connect(config.getConfig().databaseURI, function (err, res) {
  if (err) { 
    log.info ('ERROR connecting to: ' + config.getConfig().databaseURI + '. ' + err);
  } else {
    log.info ('Succeeded connected to: ' + config.getConfig().databaseURI);
  }
});

var app = express();
app.use(express.limit('4mb'));
app.use(express.static(__dirname + '/../assets'));
app.use(express.compress());
app.use(express.bodyParser());
app.use(compass());
app.set('view engine', 'jade');
app.set('views', __dirname + '/../template');
app.use(express.cookieParser());
app.use(express.favicon(__dirname + '/../assets/img/favicon.ico'));
app.use(express.session({
	key: 'driftwood.sid',
	secret: config.getConfig().secretKey,
	store: sessionStore
}));

compass({
  project: __dirname + '/../template',
  css: 'css',
  sass: 'sass'
});

app.locals.pretty = config.getConfig().environment !== 'production';

router(app, controllers, middlewareHandlers);

app.use(app.router);

var server = http.createServer(app);
var io = require('socket.io').listen(server);
var IoStore = require('socket.io/lib/stores/redis');
var ioRedis = require('socket.io/node_modules/redis');
var ioPub = ioRedis.createClient();
var ioSub = ioRedis.createClient();
var ioClient = ioRedis.createClient();
var socketStorage = ioRedis.createClient();
var sockets = require('./sockets.js');

io.set('store', new IoStore({
  redisPub: ioPub, 
  redisSub: ioSub,
  redisClient: ioClient
}));

io.set('log level', 1) //level 0 is error, level 1 is warn, level 2 is info and level 3 is debug 

io.configure(function() {
	io.set('authorization', function(data, callback) {
		if(!data.headers.cookie) {
			return callback(new Error("No cookie on authorization"));
		}

		data.cookie = cookie.parse(data.headers.cookie);
		data.sessionId = data.cookie['driftwood.sid'].substring(2, 26);
		sessionStore.load(data.sessionId, function(err, session) {
			
			if(err || !session) {
				return callback(new Error('Session not found'));
			}

			if((!session && !session.player)) {
				return callback(new Error('User is not authenticated'));
			}

			data.session = new Session(data, session);

			callback(null, true);
		});
	});

});

sockets.configureSockets(io, socketStorage);

var clearRedisSockets = function() {
    socketStorage.keys("storagePlayer:*", function(err, keys) {
      if(keys) {
        socketStorage.del(keys, function(err) {});
      }
    });
    
    log.info('Player sockets removed');

    socketStorage.keys("storageGameRoom:*", function(err, key) {
      if(key) {
        socketStorage.del(key, function(err) {});
      }
    });

    log.info('Game Room sockets removed');
};

//If the environment is not production, this clears out the sockets stored in redis to remove old data
if(config.getConfig().environment !== 'production' ) {
    clearRedisSockets();  
}

server.listen(config.getConfig().port, function() {
	module.exports.app = app;
	log.info('Server started on port ' + config.getConfig().port);
});

var shutdown = function(sig) {
    if (typeof sig === "string") {
      log.info(Date(Date.now()) + ': Received ' + sig +
        ' - terminating Node server ...');
      mongoose.connection.close();
      log.info('disconnected from database');
      process.exit(0);
    }
};

process.on('exit', function() {
   log.info("Exit event captured");
   shutdown();
});

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
  'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'].forEach(function(element, index, array) {
  process.on(element, function() {
    shutdown(element);
  });
});

