var Imap = require('imap');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var MailParser = require("mailparser").MailParser;
var fs = require('fs-extra');
var path = require('path');
var async = require('async');
var mysql      = require('mysql');
var changeCase = require("change-case");

var connection = null;
var storageDir = null;
var subjectKeyWord = null;
module.exports = AdminApp;

function AdminApp (options) {
  connection =  mysql.createConnection({
    host     : options.db_host,
    user     : options.db_user,
    password : options.db_password,
    database : options.db_name
  });
  storageDir = options.storage_dir;
  subjectKeyWord = options.subject_key_word;
  fs.mkdirsSync(storageDir);
}

AdminApp.prototype.registerImg = function (attachment, mail) {
  var generatedFileName = attachment.generatedFileName;
  var subjectWithKeyWord = mail.subject;
  var subject = subjectWithKeyWord.substring(subjectKeyWord.length);
  var params = this.parseSubject(subject);

  var self = this;

  this.storeImg(storageDir, generatedFileName, attachment.stream);
  
  var mysqlDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  var imgObj = {
    'description' : params.description,
    'price' : params.price,
    'tag' : params.tag,
    'supplier' : params.supplier,
    'image' : generatedFileName,
    'date' : mysqlDate
  };
  
  var catObjs = params.cats;
  this.insertImg(imgObj,function(err, result) {
      if (err) throw err;
      var insertId = result.insertId;
      console.log("Inserted a new Image with Id => "+insertId);

      var getCatAsyncCB = function (catId){
        var imgCatObj = {'img_id':insertId,'cat_id':catId};
        console.log("Registering imgCat",imgCatObj);
        self.insertImgCat(imgCatObj,function(err,result){
          if (err) throw err;
          console.log(result);
        });
      };
      async.each(catObjs, function(catObj, callback) {
      
      console.log("Processing ",catObj);
       self.getCategoryIdByParents(catObj,function(err,res){
            if (err) throw err;
            console.log('CatObj processed ',catObj);
            console.log("getCategoryIdByParents result",res);
            if(res[0] && res[0].id) {
              getCatAsyncCB(res[0].id);
            }
            callback();
       });
      }, function(err){
          if( err ) {
            console.log('A catObj produced an err',err);
          } else {
            console.log('All categories have been processed successfully');
          }
      });
  });
};

AdminApp.prototype.insertImg = function (vals, cb) {
  var query = connection.query('insert into img SET ?', vals, cb);    
  console.log('insertImg SQL =>',query.sql); 
};

AdminApp.prototype.insertImgCat = function (vals, cb) {
  var query = connection.query('insert into img_cat SET ?', vals, cb);    
  console.log('insertImgCat SQL =>',query.sql); 
};

AdminApp.prototype.getCategory = function (name, cb) {
  var query = connection.query('SELECT * FROM category WHERE category_name = ?', [name], cb);
  console.log('getCategory SQL =>',query.sql); 
};

AdminApp.prototype.getCategoryIdByParents = function (catObj, cb) {
  var query = connection.query("Select c2.id from category c0, category c1, category c2 where c2.category_name = ? and c1.category_name = ? and c0.category_name = ? and c2.cat_parent_id = c1.id and c1.cat_parent_id = c0.id", [catObj.subSubCat,catObj.subCat,catObj.cat], cb);
  console.log('getCategoryIdByParents SQL =>',query.sql); 
};

/*
| id  | category_name                  | cat_parent_id | level | main_catname |

SELECT id FROM category WHERE 
category_name = subSubCat and
2 = level and
1 = (select level from category where category_name = subCat) and
0 = (select level from category where category_name = cat)
*/
AdminApp.prototype.storeImg = function (dir, fileName, stream) {
    stream.pipe(fs.createWriteStream(dir+fileName));
};

AdminApp.prototype.parseSubject = function (subjectString){
  //var subjectString = 'Layout Design @ Retail Layout Design # Club ; Retail @ Retail # Club $ Description: sdcacad; Price: 44; Title: fscfssca ; Supplier : fseaas';

  var params = {};
  
  params['cats'] = [];
  
  var splits = subjectString.split('$');
  
  var cats = splits[0].split(';');
  
  var details = splits[1].split(';');
  
  for(var i=0;i<details.length;i++){
      var detail = details[i].split(':');
      
      var detailKeyL = changeCase.lowerCase(detail[0].trim());
      var detailVal = detail[1].trim();
      params[detailKeyL] = detailVal;
  }
  
  for(var j=0;j<cats.length;j++){
      var catA = cats[j].split('#');
  
      var catB = catA[0].split('@');
          
      var subSubCat = catA[1].trim();
      var cat = catB[0].trim();
      var subCat = catB[1].trim();
      params['cats'].push({
          'cat':cat,
      	'subCat':subCat,
      	'subSubCat':subSubCat});
  }
  console.log(params);
  
  return params;
}