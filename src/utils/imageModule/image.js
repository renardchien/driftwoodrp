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
var gm = require('gm');
var utils = require('../index.js');
var log = require('../../config.js').getLogger();

var imageMagick = gm.subClass({ imageMagick : true });

var Image = function(path, options) {
  options = options | {};
  this.type = options.type || 'png';
  this.path = path;
  this.img = imageMagick(path).noProfile().setFormat(this.type);
};

Image.getScaleToContainer = function(size, bounds) {
  return Math.min(size.width / bounds.width, size.height / bounds.height);
};

Image.getScaledContainer = function(size, bounds) {
  var scale = Image.getScaleToContainer(size, bounds);
  return {
    width: Math.round(size.width / scale),
    height: Math.round(size.height / scale)
  };
};

Image.prototype.getSize = function(callback) {
  this.img.size(callback);
};

Image.prototype.resize = function(dim, callback) {
  var self = this;
  this.img.size(function(err, value) {
    if(err) {
      log.error(err);
      return callback(new Error('Image data could not be read. Please try a different image.'));
    }

    if(!value) {
      return callback(new Error('Image not found'));
    }

    var newDim = Image.getScaledContainer(value, dim);
    self.img = self.img.resize(newDim.width, newDim.height);
    callback();
  });
};

Image.prototype.uploadStream = function(path, callback) {
  var self = this;
   if (typeof(path) !== 'string') {
     return callback(new Error("Path must be a string"));
   }

   if(path.charAt(0) === '/') {
     path = path.substring(1);
   }

   this.img.stream(function(err, stdout, stderr) {
     if(err) {
       return callback(err);
     }

     utils.uploadModule.uploadStream(stdout, path, self.type, callback);
   });
};
module.exports.Image = Image;
