var Imap = require('imap'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    MailParser = require("mailparser").MailParser,
    fs = require("fs-extra"),
    path = require('path'),
    async = require('async'),
    nconf = require('nconf');

// First consider commandline arguments and environment variables, respectively.
nconf.argv().env();

// Then load configuration from a designated file.
nconf.file({ file: 'config.json' });

// Provide default values for settings not provided above.

nconf.defaults({
'adminApp': {
        'subjectKeyWord': '[UZO]'
    }
});

var MailListener=require('./lib/mailListener');
var AdminApp = require("./lib/uzodocs");

var adminApp = new AdminApp({
  db_host: nconf.get('db:host'),
  db_name: nconf.get('db:name'),
  db_user: nconf.get('db:user'),
  db_password: nconf.get('db:password'),
  storage_dir: nconf.get('adminApp:storage_dir'),
  subject_key_word: nconf.get('adminApp:subjectKeyWord')
});

var mailListener = new MailListener({
  username: nconf.get('mailListener:username'),
  password: nconf.get('mailListener:password'),
  host: nconf.get('mailListener:host'),
  port: nconf.get('mailListener:port'), // imap port 
  tls: nconf.get('mailListener:tls'),
  tlsOptions: { rejectUnauthorized: nconf.get('mailListener:host') },
  mailbox: nconf.get('mailListener:mailbox'), // mailbox to monitor 
  //'searchFilter': ['UNSEEN',['SUBJECT', '[UZO]']], // the search filter being used after an IDLE notification has been retrieved 
  searchFilter:  ['UNSEEN',['SUBJECT', nconf.get('adminApp:subjectKeyWord')]], // the search filter being used after an IDLE notification has been retrieved 
  markSeen: nconf.get('mailListener:markSeen'), // all fetched email will be marked as seen and not fetched next time 
  fetchUnreadOnStart: nconf.get('mailListener:fetchUnreadOnStart'), // use it only if you want to get all unread email on lib start. Default is `false`, 
  mailParserOptions: {streamAttachments: nconf.get('mailListener:mailParserOptions:streamAttachments')}, // options to be passed to mailParser lib. 
  attachments: nconf.get('mailListener:attachments'), // download attachments as they are encountered to the project directory 
  attachmentOptions: { directory: nconf.get('mailListener:attachmentOptions:directory') } // specify a download directory for attachments 
});
 
mailListener.start(); // start listening 
 
// stop listening 
//mailListener.stop(); 
 
mailListener.on("server:connected", function(){
  console.log("imap Connected");
});
 
mailListener.on("server:disconnected", function(){
  console.log("imap Disconnected");
});
 
mailListener.on("error", function(err){
  console.log(err);
});
 
mailListener.on("mail", function(mail, seqno, attributes){
  // do something with mail object including attachments 
  //console.log("emailParsed", mail);
  // mail processing code goes here 
});
 
mailListener.on("attachment", function(attachment, mail){
  console.log("attachment",attachment);
  console.log("emailParsed", mail);
  adminApp.registerImg(attachment, mail);
});
 
// it's possible to access imap object from node-imap library for performing additional actions. E.x. 
//mailListener.imap.move(:msguids, :mailboxes, function(){})
