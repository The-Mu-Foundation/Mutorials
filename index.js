
const bodyParser = require("body-parser");
const user = require("./routes/user");
const auth = require("./middleware/auth");
const passport = require("passport");
const crypto = require("crypto");
const LocalStrategy = require('passport-local').Strategy;

const mongoose = require('mongoose'); 
const express = require("express");
const session = require("express-session");
var db = mongoose.connection;
const InitiateMongoServer = require("./config/db");

// start server
InitiateMongoServer();
const PORT = process.env.PORT || 3000;

const app = express();

//session
const MongoStore = require("connect-mongo")(session);

//this is variables, see if user.js works first
const UserSchema = new mongoose.Schema({
  username: String,
  hash: String,
  salt: String
});
const User = db.model('User', UserSchema);

const sessionStore = new MongoStore({mongooseConnection: db, collection: 'sessions'});
app.use(session({
  secret: "blahblah",
  resave: false,
  saveUninitialized: true,
  store: sessionStore
}));


//middleware
//app.use(bodyParser.json());

//passport

//checks to see if its a valid password or not @hash is the stored pass, password is user inputted
function validPassword(password, hash, salt) {
  var hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === hashVerify;
}

//generates plain text password to hash
function genPassword(password) {
  var salt = crypto.randomBytes(32).toString('hex');
  var genHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  
  return {
    salt: salt,
    hash: genHash
  };
}
//called when passport.authenticate is used()
passport.use(new LocalStrategy(
  function(username, password, cb) {
      User.findOne({ username: username })
          .then((user) => {
              if (!user) { return cb(null, false) }
              
              // Function defined at bottom of app.js
              const isValid = validPassword(password, user.hash, user.salt);
              
              if (isValid) {
                  return cb(null, user);
              } else {
                  return cb(null, false);
              }
          })
          .catch((err) => {   
              cb(err);
          });
}));
passport.serializeUser(function(user, cb) {
  cb(null, user.id);
});
passport.deserializeUser(function(id, cb) {
  User.findById(id, function (err, user) {
      if (err) { return cb(err); }
      cb(null, user);
  });
});

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded());





//webpages

// POST ROUTES

app.post('/login', passport.authenticate('local', { failureRedirect: '/homepage', successRedirect: '/train' }),
 //passport.authenticate('local', { failureRedirect: '/homepage', successRedirect: '/train' }), 
 ( req, res, next) => {
   console.log("Oh hi");
   //const pw = passport.authenticate('local', { failureRedirect: '/homepage', successRedirect: '/train' });
   //pw(req, res, next); 
 // if (err) next(err);
});
app.post('/register', (req, res, next) => {
    
  const saltHash = genPassword(req.body.password);
  
  const salt = saltHash.salt;
  const hash = saltHash.hash;
  const newUser = new User({
      username: req.body.username,
      hash: hash,
      salt: salt
  });
  newUser.save()
      .then((user) => {
          console.log(user);
      });
  res.redirect('/train');
});

app.post('/admin/addquestion', (req, res, next) => {
  // ADD TO DATABASE
  // REDIRECT TO admin/confirmaddquestion to confirm to see if additional changes need to be made
});

// GET ROUTES

app.get("/", (req, res) => {
  res.json({ message: "API Working" });
});

app.get("/signin", (req, res) => {
  res.render(__dirname + '/views/public/' + 'login.ejs');
});

app.get("/signup", (req, res) => {
  res.render(__dirname + '/views/public/' + 'signup.ejs');
});

app.get("/homepage", (req, res) => {
  res.render(__dirname + '/views/' + 'homepage.ejs');
});

app.get("/train", (req, res) => {
  if(req.isAuthenticated()){
    res.render(__dirname + '/views/' + 'train.ejs');
  }
  else{
    res.redirect("/home");
  }
});

app.get("/settings", (req, res) => {
  res.render(__dirname + '/views/' + 'settings.ejs');
});

app.get("/AdminAdd", (req, res) => {
  res.render(__dirname + '/views/' + 'train_admin_addQuestion.ejs');
});

app.get("/home", (req, res) => {
  res.render(__dirname + '/views/public/' + 'index.ejs');
});

app.use('/user', user); //user path to get to signin/login

app.listen(PORT, (req, res) => {
  console.log(`Server Started at PORT ${PORT}`);
});
