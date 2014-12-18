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

var AWS = require('aws-sdk');
var fs = require('fs');
var mime = require('mime');
var config = require('../../config.js');
var logger = config.getLogger();
var imgExtRegex = new RegExp(/(gif|jpg|jpeg|tiff|png)$/i);

var awsKey = config.getConfig().specialConfigs.awsKey;
var awsSecret = config.getConfig().specialConfigs.awsSecret;
var awsBucket = config.getConfig().specialConfigs.awsBucket;

if(!awsKey || !awsSecret || !awsBucket) {
  logger.error("Missing AWS configuration for mail module. Missing key awsKey, awsSecret or awsBucket");
  process.exit(5);
}

AWS.config.update({  
  accessKeyId: awsKey,
  secretAccessKey: awsSecret
});

var s3 = new AWS.S3();

var uploadStream = function(fileStream, publicPath, fileExtension, callback) {
  var buffers = []; 
  
  if(typeof(publicPath) !== 'string') {
    var err = new Error("File failed to upload to storage");
    return callback(err);
  }

  fileStream.on('data', function(chunk) {
    buffers.push(chunk);
  });

  fileStream.on('end', function(chunk) {
    if(chunk) {
      buffers.push(chunk);
    }

    var completeBuffer = Buffer.concat(buffers);

    s3.putObject({
      Bucket: awsBucket,
      Key: publicPath,
      Body: completeBuffer,
      ContentType: mime.lookup(fileExtension),
      CacheControl: 'private, max-age=0, must-revalidate',
      ACL: 'public-read'
      }, function(err, res) {
           if(err) {
	     return callback(err);
           }

           callback(null, res);
     });
  });
  
};

var uploadAsset =  function(file, publicPath, callback) {
  var fileExtension = file.name.split('.').pop();
  
  if(!fileExtension || !(imgExtRegex.test(fileExtension))) {
    var err = new Error("Only files of type gif, jpg, jpeg, tiff or png are accepted");
    return callback(err);
  }

  var fileStream = fs.createReadStream(file.path);

  uploadStream(fileStream, publicPath, fileExtension, callback);
  
};

var removeAsset = function(s3Asset, callback) {
  s3.client.deleteObject({
    Bucket: awsBucket,
    Key: s3Asset
  }, callback);
};

module.exports.uploadAsset = uploadAsset;
module.exports.removeAsset = removeAsset;
module.exports.uploadStream = uploadStream;
