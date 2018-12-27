var express = require('express')
var app = express()
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var pg = require('pg')
var session = require('express-session')
var passport = require('passport')
var Strategy = require('passport-local').Strategy;
var pgSession = require('connect-pg-simple')(session);
var db = require('./db');
var config = require('./config')
var cors = require('cors');
var mongoose = require('mongoose');
var date =require('date-and-time');
var Schema = mongoose.Schema;
const fileUpload = require('express-fileupload');
const AWS = require('aws-sdk');

//s3


var EventModel = mongoose.model('Events', new Schema({ uId: Number, activity: String, date: String }));

var UserModel = mongoose.model('Users', new Schema({ email: String, name: String, birthday: String, address: String , image: String}));
// Works
//MyModel.findOne(function(error, result) { console.log(result) });

app.use(cors({
  credentials: true,
  origin: 'http://yao.walsin.com'
}));

// default options
app.use(fileUpload());

// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*")
//   res.header("Access-Control-Allow-Headers", "Authorization, X-Requested-With, Content-Type, X-HTTP-Method");
//   res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
//   res.header("Content-Type", "application/json")
//   next();
// });

passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});

passport.deserializeUser(function(id, done) {
  // db.users.findById(id, function (err, user) {
  //   if (err) { return cb(err); }
  //   cb(null, user);
  // });
  let client = new pg.Client(config.db);
  client.connect(err => {
        if (err) {
          console.log(err)
        }
        else {
          const query = {
            name: 'fetch-user',
            text: 'SELECT * FROM users WHERE id = $1',
            values: [id]
          }
            client.query(query)
                .then(resp => {
                  return done(null, resp.rows[0])
                  client.end();
                })
                .catch(err => {
                    console.log(err);
                });
        }
    });
});


app.use(require('cookie-parser')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  store: new pgSession({
    pg : pg,                                  // Use global pg-module
    conString : 'http://127.0.0.1:5432', // Connect using something else than default DATABASE_URL env variable
    tableName : 'session'               // Use another table-name than the default "session" one
  }),
  secret: 'keyboard cat',
  resave: false, saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/usercheck', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  if(req.user){
    res.json({result: 'uId : '+req.user.id});
  }else{
    res.json({result: 'error'})
  }

})

app.get('/getEvents', function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  mongoose.connect('mongodb://localhost:27017/final');
  EventModel.find({uId: req.session.passport.user},function(error, result) { console.log(result);res.json({result: result}); mongoose.disconnect();});
})

app.post('/addEvents', function (req, res) {
  mongoose.connect('mongodb://localhost:27017/final');
  let event = new EventModel({uId:req.session.passport.user, activity: req.body.activity, date: req.body.date});
  event.save(function (err) {
    if (err){
    console.log(err)
  mongoose.disconnect();}
    else{
      console.log('save event sucessfully')
      console.log(req.session.passport.user)
      mongoose.disconnect();
    }
    // saved!
  });
  res.setHeader('Content-Type', 'application/json');
  if(req.user){
    res.json({result: req.user});
  }else{
    res.json({result: 'error'})
  }
})

app.post('/upload', function(req, res) {
  mongoose.connect('mongodb://localhost:27017/final');
  let file = req.files.foo; // the uploaded file object
  let now = new Date();
  let filename = date.format(now, 'YYYYMMDDHHmmss')+file.name;
  let s3bucket = new AWS.S3({
   accessKeyId: IAM_USER_KEY,
   secretAccessKey: IAM_USER_SECRET,
   Bucket: BUCKET_NAME,
 });
 let params = {
    Bucket: BUCKET_NAME,
    Key: filename,
    Body: file.data,
   };
 s3bucket.upload(params, function (err, data) {
    if (err) {
     console.log('error in callback');
     console.log(err);
     res.json({result: 's3 upload failure'});
    }
    UserModel.findOneAndUpdate({email: req.user.email}, {$set:{image:filename}}, {new: true}, (err, doc) => {
    if (err) {
        res.json({result: 'image sync failure'});
    }
      res.send('File uploaded!');
    mongoose.disconnect();
});
   });
});

app.listen(3001)
