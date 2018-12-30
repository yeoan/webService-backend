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
  res.setHeader('Content-Type', 'application/json');
  console.log(req)
  let file = req.files.file; // the uploaded file object
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
    res.json({result: 's3 upload sucessfully!'});
    mongoose.disconnect();
  });
   });
});

app.post('/getUserProfile',function(req, res) {
  mongoose.connect('mongodb://localhost:27017/final');
  res.setHeader('Content-Type', 'application/json');
  UserModel.find({email: req.user.email},function(error, result) { console.log(result);res.json({result: result}); mongoose.disconnect();});
  //res.json({result: })
});

app.post('/editUserProfile',function(req, res) {
  mongoose.connect('mongodb://localhost:27017/final');
  res.setHeader('Content-Type', 'application/json');
  console.log(req.body)
  UserModel.findOneAndUpdate({email: req.user.email}, {$set:{name: req.body.username, address: req.body.address, birthday: req.body.birthday}}, {new: true}, (err, doc) => {
  if (err) {
      res.json({result: 'userProfile sync failure'});
  }
  res.json({result: 'edit sucessfully!'});
  mongoose.disconnect();
});
});

app.post('/getImage',function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  let s3bucket = new AWS.S3({
   accessKeyId: IAM_USER_KEY,
   secretAccessKey: IAM_USER_SECRET,
   Bucket: BUCKET_NAME,
 });
 let params = {
    Bucket: BUCKET_NAME,
    Key: req.body.filename,
   };
   s3bucket.getObject(params, function (errtxt, file) {
    if (errtxt) {
        console.Log("lireFic", "ERR " + errtxt);
    } else {
        res.json({result: file});
    }
});
});

app.post('/getRevents',function(req, res){
  res.setHeader('Content-Type', 'application/json');
  let firstDayHours = req.body.weather.length-32;
  let rweather = [];
  console.log(req.body.weather.length)
  let Day1 = req.body.weather.slice(0,parseInt(firstDayHours)-1);
  let Day2 = req.body.weather.slice(parseInt(firstDayHours),parseInt(firstDayHours)+7);
  let Day3 = req.body.weather.slice(parseInt(firstDayHours)+8,parseInt(firstDayHours)+15);
  let Day4 = req.body.weather.slice(parseInt(firstDayHours)+16,parseInt(firstDayHours)+23);
  let Day5 = req.body.weather.slice(parseInt(firstDayHours)+24,parseInt(firstDayHours)+31);
  let goToOutSide1 = 0;
  let goToOutSide2 = 0;
  let goToOutSide3 = 0;
  let goToOutSide4 = 0;
  let goToOutSide5 = 0;
  Day1.map((item,index)=>{
    switch (item.weather[0].main) {
      case 'Clear':
        goToOutSide1 = goToOutSide1+20;
        break;
      case 'Clouds':
        goToOutSide1 = goToOutSide1+15;
        break;
      case 'Rain':
        goToOutSide1 = goToOutSide1-15;
        break;
      case 'Snow':
        goToOutSide1 = goToOutSide1-15;
        break;
      default:
    }
    if(index==Day1.length-1){
      rweather.push(goToOutSide1)
    }
  })

  Day2.map((item,index)=>{
    switch (item.weather[0].main) {
      case 'Clear':
        goToOutSide2 = goToOutSide2+20;
        break;
      case 'Clouds':
        goToOutSide2 = goToOutSide2+15;
        break;
      case 'Rain':
        goToOutSide2 = goToOutSide2-15;
        break;
      case 'Snow':
        goToOutSide2 = goToOutSide2-15;
        break;
      default:
    }
    if(index==Day2.length-1){
      rweather.push(goToOutSide2)
    }
  })

  Day3.map((item,index)=>{
    switch (item.weather[0].main) {
      case 'Clear':
        goToOutSide3 = goToOutSide3+20;
        break;
      case 'Clouds':
        goToOutSide3 = goToOutSide3+15;
        break;
      case 'Rain':
        goToOutSide3 = goToOutSide3-15;
        break;
      case 'Snow':
        goToOutSide3 = goToOutSide3-15;
        break;
      default:
    }
    if(index==Day3.length-1){
      rweather.push(goToOutSide3)
    }
  })

  Day4.map((item,index)=>{
    switch (item.weather[0].main) {
        case 'Clear':
          goToOutSide4 = goToOutSide4+20;
          break;
        case 'Clouds':
          goToOutSide4 = goToOutSide4+15;
          break;
        case 'Rain':
          goToOutSide4 = goToOutSide4-15;
          break;
        case 'Snow':
          goToOutSide4 = goToOutSide4-15;
          break;
        default:
      }
    if(index==Day4.length-1){
      rweather.push(goToOutSide4)
    }
  })

  Day5.map((item,index)=>{
      switch (item.weather[0].main) {
        case 'Clear':
          goToOutSide5 = goToOutSide5+20;
          break;
        case 'Clouds':
          goToOutSide5 = goToOutSide5+15;
          break;
        case 'Rain':
          goToOutSide5 = goToOutSide5-15;
          break;
        case 'Snow':
          goToOutSide5 = goToOutSide5-15;
          break;
        default:
      }
    if(index==Day5.length-1){
      rweather.push(goToOutSide5)
    }
  })

  res.json({result: rweather})
});

app.listen(3001)
