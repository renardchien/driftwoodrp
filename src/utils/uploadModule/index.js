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

var config = require("../../config.js");    
var s3 = require ("./s3.js");

var uploadAsset = function(file, publicPath, callback) {
  //There should be an if statement here to check if dev or prod for local or s3

  s3.uploadAsset(file, publicPath, callback);
};

var removeAsset = function(file, callback) {
  //There should be an if statement here to check if dev or prod for local or s3

  s3.removeAsset(file, callback);
};

var uploadStream = function(stream, publicPath, extension, callback) {
  //There should be an if statement here to check if dev or prod for local or s3

  s3.uploadStream(stream, publicPath, extension, callback);
};

module.exports.uploadAsset = uploadAsset;
module.exports.removeAsset = removeAsset;
module.exports.uploadStream = uploadStream;

