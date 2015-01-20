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

var path = require('path');
var http = require ('http');	     
var express = require("express");
var compression = require('compression');  
var favicon = require('serve-favicon'); 
var cookieParser = require('cookie-parser'); 
var bodyParser = require('body-parser'); 
var mongoose = require("mongoose");
var session = require('express-session');
var Session = session.Session;
var RedisStore = require('connect-redis')(session); 
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
var multer = require('multer');
//var compass = require('node-compass');

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

var sessionStore = new RedisStore({
	host: config.getConfig().redisURL.hostname,
  port: config.getConfig().redisURL.port,
  pass: config.getConfig().redisURL.redisPASS 
});

var app = express();

app.use('/assets', express.static(path.resolve(__dirname + '/../assets')));
app.use(compression()); 
app.use(bodyParser.urlencoded({ 
  extended: true,
  limit: '4mb'
}));
app.use(multer({ 
  dest: path.resolve(__dirname + '/../assets/uploads'),
  limits: {
    fieldNameSize: 100,
    fileSize: 4000000
  }
}));
//app.use(compass());
app.set('view engine', 'jade'); 
app.set('views', __dirname + '/../template');
app.use(favicon(__dirname + '/../assets/img/favicon.ico')); 
app.disable('x-powered-by'); 
app.use(cookieParser()); 

app.use(session({
    key: "driftwood.sid", 
    store: sessionStore,
    secret: config.getConfig().secretKey,
    resave: true,
    saveUninitialized: true
})); 

/**
compass({
  project: __dirname + '/../template',
  css: 'css',
  sass: 'sass'
}); **/

app.locals.pretty = config.getConfig().environment !== 'production';

router(app, controllers, middlewareHandlers);

var server = app.listen(config.getConfig().port, function(err) { 
    if (err) {
      throw err;
    }
	module.exports.app = app;
	log.info('Server started on port ' + config.getConfig().port);
});

var io = require('socket.io').listen(server);
/**
var IoStore = require('socket.io/lib/stores/redis');
var ioRedis = require('redis');
var ioPub = ioRedis.createClient();
var ioSub = ioRedis.createClient(); 
var ioClient = ioRedis.createClient(); **/
var ioRedis = require('socket.io-redis')

var ioRedisClient = require('socket.io-redis/node_modules/redis').createClient,
    ropts = {/* your redis options */}, subOpts = { detect_buffers:true },
    pub = ropts.socket ? ioRedisClient(ropts.socket) : ioRedisClient(ropts.port, ropts.host),
    sub = ropts.socket ? ioRedisClient(ropts.socket, subOpts) : ioRedisClient(ropts.port, ropts.host, subOpts);
if (ropts.pass) {
    pub.auth(ropts.pass, function(err) { if (err) { throw err; } });
    sub.auth(ropts.pass, function(err) { if (err) { throw err; } });
}
io.adapter(require('socket.io-redis')({
    pubClient:pub, subClient:sub
}));

var socketStorage = ioRedisClient();
var sockets = require('./sockets.js');

/**
io.set('store', new IoStore({
  redisPub: ioPub, 
  redisSub: ioSub,
  redisClient: ioClient
})); **/
/**
io.adapter(ioredis({
    host: 'localhost',
    port: 6379
})) **/

io.use(function(socket, callback) { 

		if(!socket.handshake.headers.cookie) {
			return callback(new Error("No cookie on authorization"));
		}

		socket.cookie = cookie.parse(socket.handshake.headers.cookie);
		socket.sessionId = socket.cookie['driftwood.sid'].substring(2, 34);
		sessionStore.load(socket.sessionId, function(err, session) {
			if(err || !session) {
				return callback(new Error('Session not found'));
			}

			if((!session && !session.player)) {
				return callback(new Error('User is not authenticated'));
			}

			socket.session = new Session(socket, session);

			callback(null, true);
		});

});

sockets.configureSockets(io, socketStorage);
//sockets.configureSockets(io, socketStorage);


/**
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
}**/

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

//['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
//  'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGPIPE', 'SIGTERM'].forEach(function(element, index, array) {
//  process.on(element, function() {
//    shutdown(element);
//  });
//});

['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS',
  'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'].forEach(function(element, index, array) {
  process.on(element, function() {
    shutdown(element);
  });
});

