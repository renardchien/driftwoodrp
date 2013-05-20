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

var nodemailer = require('nodemailer');
var config = require('../../config.js');
var logger = config.getLogger();

var awsKey = config.getConfig().specialConfigs.awsKey;
var awsSecret = config.getConfig().specialConfigs.awsSecret;
var sesEmail = config.getConfig().specialConfigs.sesEmail;

if(!awsKey || !awsSecret || !sesEmail) {
  logger.error("Missing AWS configuration for mail module. Missing key awsKey, awsSecret or sesEmail");
  process.exit(5);
}

var transport = nodemailer.createTransport("SES", {
  AWSAccessKeyID: config.getConfig().specialConfigs.awsKey,
  AWSSecretKey: config.getConfig().specialConfigs.awsSecret
});

var sendMail = function(to, subject, text) {
  var mailOptions = {
    from: config.getConfig().specialConfigs.sesEmail,
    to: to,
    subject: subject,
    text: text
  };

  transport.sendMail(mailOptions, function(err, responseStatus) {
    if(err) {
      logger.error(err);
    }
  });
};

module.exports.sendMail = sendMail;
