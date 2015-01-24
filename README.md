# License
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

## DriftwoodRP
DriftwoodRP is a set of tools to aid players of tabletop role playing games in an digital collaborative space. These tools are intended to allow players to play traditionally offline tabletop role playing games online, while maintaining the immersive and personal experiences of being in person as closely as possible. DriftwoodRP supports map grids, image/token/map uploading, image scaling, image rotation, free drawing, chat, dice rolling, user permissions, GM permissions and more. The tools are written in HTML 5, Javascript, JSON and CSS. All tools are still prototypes. 

The tools can be used in face-to-face games as a pencil-and-paper engine. Players have used DriftwoodRP as a way to track, store and load game sessions.

These tools can be used in video chat games as a near real-time online pencil-and-paper engine. Players have used DriftwoodRP as a way to play tabletop role playing games online and have a shared experience. Without a physical table or game board, it can be very difficult to play some tabletop games. DriftwoodRP allows players to make a map, upload images, upload player tokens, track player movement and play games in near real-time.

Outside of role-playing games, DriftwoodRP can be used as a generic pencil-and-paper engine. It can be used to play Miniature games, strategy board games (Chess, Go, Mancala) or most games that just need a board and tokens.

DriftwoodRP has been used for quick prototyping of games as well.

## Dependencies
This project requires the following to be installed. 

* NPM/Node.js
* ImageMagick
* MongoDB
* Redis

## Install
In the root folder run the follow command.

`npm install`

## Setup
In order to actually run the system, you should create and configure the following files. Refer to the configs section for configuration options and example.

_Sample files have been included for each of these_

* /src/config.json
* /src/secrets.json
* /src/configs/emailConfig.json
* /src/configs/imageConfig.json
* /src/configs/awsConfig.json (file is necessary, but AWS is not)

## Running

1. Ensure both Mongo and Redis are running and accessible.

2. In the root directory, run the command `npm start`

## Configs
There are a number of config files that handle different configurations. Currently five config files are necessary. In the future, defaults may be added so that the config files are not necessary. 

There are two main configs for the application /src/config.json and /src/secrets.json. The */src/configs* folder handles special configurations for various modules. In theory, modules can be transparently switched with another module with the same API and the application should continue to run. This is why the */src/configs* folder exists. 

Any file ending in .json added to the */src/configs* folder is automatically loaded on application start. All of the variables will be loaded into the application as `config.specialConfigs` in code. 

### /src/config.json

* `Environment`: *development* or *production*. This tells the application how to run the app. In *development*, the `url` config field is used for all address, hosting and asset resolution. When *production* is used, the `liveUrl` config field is used for all address, hosting and asset resolution.

* `liveUrl`: Any domain name you are hosting. This is the address that the application will use if running in *production*. All of the images, CSS files, clientside JS files, etc will be pointing at this address.

* `url`: The local IP you are hosting on. This is the address that the application will use if running in *development*. All of the images, CSS files, clientside JS files, etc will be point at this address. _If you are developing on your local machine, this address combined with the port will be used to reach the page in the browser_. For example, in the browser you might type `127.0.0.1:3000`. 

* `port`: This is the port that the server is hosted on. Upon starting the application, node will open this port. If in development, you will use the IP address and the port to get to reach the site. For example `127.0.0.1:3000`. If you are in production, then this will either be the port you type in the browser or the port that your web server (NGinx, Apache, etc) will forward to.

* `databaseURI`: This is the full MongoDB URI to your database. 

* `redisURL`: This is a JSON object of the Redis database properties. The `hostname` is the address your Redis database (local default is *localhost*). The `port` is the port to your Redis database (local default is *6379*. The `pass` is your Redis database password. *The `pass` optional field - can be omitted from the redisURL config field *.

* `logToFile`: *true* or *false*. Setting this to *true* writes all of the server logs to the console and to a file specified by `logLocation` config field. Setting this to *false* only writes logs to the console. Logging is done by [Winston](https://github.com/flatiron/winston) 

* `logLocation`: This is the path to your log file. The default folder is the logs folder provided in the application. For development it is recommended you use the logs folder provided or /tmp/ (on Mac/Linux) For production enviroments, it is recommended to put the logs in a more expected place such as /tmp/ (on Mac/Linux) or /var/log/ (on Mac/Linux). *If you are running on Windows, you can use the logs folder provided or provide a Windows path (C:/path/to/your/file)*.  

##### Default Configuration
```json
{
  "environment": "development",
  "liveUrl": "yourURL.com",
  "url": "http://127.0.0.1",
  "port": 3000,
  "databaseURI": "mongodb://localhost/Driftwood",
  "redisURL": { 
    "hostname": "localhost",
    "port": 6379,
    "pass": "yourRedisAuth"
  },
  "logToFile": true,
  "logLocation": "logs/"
}
```

##### Example Config without Redis password and disabled logging to file
```json
{
  "environment": "development",
  "liveUrl": "yourURL.com",
  "url": "http://127.0.0.1",
  "port": 3000,
  "databaseURI": "mongodb://localhost/Driftwood",
  "redisURL": { 
    "hostname": "localhost",
    "port": 6379
  },
  "logToFile": false,
  "logLocation": "logs/"
}
```

##### Example Config of Production Environment (on Linux)
```json
{
  "environment": "production",
  "liveUrl": "yourAwesomeSite.co.uk.lol",
  "url": "http://127.0.0.1",
  "port": 3000,
  "databaseURI": "mongodb://localhost/Driftwood",
  "redisURL": { 
    "hostname": "localhost",
    "port": 6379,
    "pass": "superSecretPassword"
  },
  "logToFile": true,
  "logLocation": "/tmp/"
}
```

### /src/secrets.json

* `secret`: This is the secret key used for sessions. This key is used to generate each session key used by client browsers to identify who the user is.

##### Default Configuration
```json
{
  "secret": "yourSecretKeyForSessions"
}
```

##### Example Config with real secret key
```json
{
  "secret": "TheBeatsGoOn"
}
```

##### Example Config with long secret key (SHA-256 hash of "TheBeatsGoOn")
```json
{
  "secret": "3bc4486bf7cc44a3e9d206b8b48e57d1f968bef40df8b4463f863f28228ab768"
}
```

### /src/configs/emailConfig.json

* `enableEmailSupport`: *true* or *false*. __This enables or disables emails through Amazon Web Services (AWS)__. If you set this to *true*, it is currently necessary to have the */src/configs/awsConfig.json* file configured with valid data. Setting this flag to *true* will also the application to send new users a welcome email, email password reset information and notify the user of changes to their account. Setting this flag to *false* disables all emails to users.

##### Default Configuration
```json
{
 "enableEmailSupport":false
}
```

### /src/configs/imageConfig.json

* `imageSize`: This is a JSON object of the image hosting properties. The `thumb` object is a JSON object specifying the height and width (in pixels) of thumb nail images on the server. When images are uploaded, a thumb nail will be created of the specified size.  __Thumbnails may be removed in the future__.

* `imgLocalHosting`: *true* or *false*. __This specifies whether the images are being uploaded and hosted from the local machine or Amazon Web Services (AWS)__. If this field is set to *true* then user images will be uploaded to *assets/uploads* in the root directory of this application. If this field is set to *false*, then all user images are uploaded to AWS instead. If you set this to *false*, then it is necessary to have the */src/configs/awsConfig.json* file configured with valid data.

##### Default Configuration

```json
{
  "imageSize" : 
  {
    "thumb": 
    {
      "height": "50",
      "width": "50"
    }
  },
  "imgLocalHosting": true
}
```

##### Example Config with AWS Hosting and 40px Thumbnails
```json
{
  "imageSize" : 
  {
    "thumb": 
    {
      "height": "40",
      "width": "40"
    }
  },
  "imgLocalHosting": false	
}
```

### /src/configs/awsConfig.json

* `awsUrl`: This is the URL to your AWS S3 service. This is the domain in which you retrieve assets from S3. If `imgLocalHosting` is disabled, then this is where the server will upload assets to and where client browsers will try to retrieve images from. __If `imgLocalHosting` is enabled AND `enableEmailSupport` is disabled, then this field can point anywhere__.

* `sesEmail`: This is the email address to send email address from on AWS SES. This is the email verified with Amazon to send emails to users for account creation, password resets and account updates. __If `enableEmailSupport` is disabled, then this field can be any address since emails will not be sent`__.

* `awsKey`: This is the access key provided to you by AWS. This key allows the application to talk to your AWS services. __If `imgLocalHosting` is enabled AND `enableEmailSupport` is disabled, then this can be any value__.

* `awsSecret`: This is the secret access key provided to you by AWS. This key allows the application to authenticate with AWS services. __If `imgLocalHosting` is enabled AND `enableEmailSupport` is disabled, then this can be any value__.

* `awsBucket`: This is the name of your AWS S3 bucket. If `imgLocalHosting` is disabled, then this is the storage bucket that assets will be uploaded to. __If `imgLocalHosting` is enabled, then this can be any value__.

##### Default Configuration

```json
{
  "awsUrl": "https://s3.amazonaws.com/SERVICENAME/",
  "sesEmail": "support@yourwebsite.com",
  "awsKey": "awsAccessKey",
  "awsSecret": "awsSecretKey",
  "awsBucket": "awsBucketName"
}
```

##### Custom Configuration

```json
{
  "awsUrl": "https://s3.amazonaws.com/myDriftwood/",
  "sesEmail": "support@yourAwesomeSite.co.uk.lol",
  "awsKey": "ABCDEFGHIJKLMNOPQRST",
  "awsSecret": "abc123def+abc123def456ghi789jkl0+zyx987wvu",
  "awsBucket": "myDriftwood"
}
```

### Resetting the Database and Images
If you are developing, sometimes you will need to clear out the database and image uploads as you make changes to the application.

##### Deleting the Images
If `imgLocalHosting` is enabled, then you will need to remove the images from the */assets/uploads/* folder. __Make sure you keep the .gitkeep file in the */assets/uploads/* folder. Only remove the images__. If you do remove the .gitkeep file, just remake a file in the folder called .gitkeep. It does not need any information it. The file is empty and is just used to track the folder without uploading all user images to git. 

If `imgLocalHosting` is disabled, then you do not have to remove anything. You may choose to delete old images from your AWS S3 account to save on space.

##### Resetting the Database.
To reset the database open a mongo client to your database. Use the *driftwood* database. Then remove the entries from the *players*, *sessionchats*, *sessionlibraries*, *sessionplayers* and *sessions* collections.

```javascript
use Driftwood;
db.players.remove();
db.sessionchats.remove();
db.sessionlibraries.remove();
db.sessionplayers.remove();
db.sessions.remove();
exit;
``` 

