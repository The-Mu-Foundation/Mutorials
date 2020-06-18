
const bodyParser = require("body-parser");
//const user = require("./routes/user");
//const auth = require("./middleware/auth");
const passport = require("passport");
const crypto = require("crypto");
const LocalStrategy = require('passport-local').Strategy;
//const flash = require("connect-flash");
const mongoose = require("mongoose"); 
const express = require("express");
const session = require("express-session");
var db = mongoose.connection;
const InitiateMongoServer = require("./config/db");
const subjects = require("./models/subjects");
//const ratings = require("./models/userRatings");
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
  salt: String,
  rating: {
    physics: Number,
    chemistry: Number,
    biology: Number,
    physicsRate: Number,
    chemistryRate: Number,
    biologyRate: Number
  } //first index is phys, then chem, then bio; fourth index is 1/0 for proficiency
});

const qSchema = new mongoose.Schema({
  question: String,
  choices: Array,
  tags: Array,
  rating: String,
  answer: Array,
  answer_ex: String,
  author: String,
  type: String,
  ext_source: String,
  subject: Array,
  units: Array
})
const Ques = db.model('Ques', qSchema, 'questions');
const User = db.model('User', UserSchema);
//session collection
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

//generates plain text password to hash
function genPassword(password) {
  var salt = crypto.randomBytes(32).toString('hex');
  var genHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  
  return {
    salt: salt,
    hash: genHash
  };
}
//checks to see if its a valid password or not @hash is the stored pass, password is user inputted
function validPassword(password, hash, salt) {
  var hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === hashVerify;
}


//called when passport.authenticate is used()
passport.use(new LocalStrategy(
  function(username, password, cb) {
      User.find({ username: username })
          .then((user) => {
              if (!user) { return cb(null, false) }
              
              // Function defined at bottom of app.js
              const isValid = validPassword(password, user[0].hash, user[0].salt);
              
              if (isValid) {
                  return cb(null, user[0]);
              } else {

                  return cb(null, false);
              }
          })
          .catch((err) => {   
            cb(err);
          });
}));
passport.serializeUser(function(user,cb) {
  cb(null, user.id);
});
passport.deserializeUser(function(id,cb) {
  User.findById(id, function (err, user) {
      if (err) { return cb(err); }
    cb(null, user);
  });
});

app.use(bodyParser.urlencoded());
app.use(passport.initialize());
app.use(passport.session());

//app.use(flash);




//webpages

// POST ROUTES

app.post('/login', passport.authenticate('local', {failureRedirect: "/signin", successRedirect: '/homepage'}),
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
      salt: salt,
      rating: {
        physics: -1,
        chemistry: -1,
        biology: -1
      }
  });
  //dupe user?
  db.collection('users').findOne({username: req.body.username}).then((user) => {
    if(user){
      console.log("used");
    }
    else{
      console.log("new one");
      newUser.save()
          .then((user) => {
              //passport.authenticate('local', {failureRedirect: "/signin", successRedirect: '/train'});
              console.log(user);
          });
    }
    res.redirect('/signin');
    });
});

//const questionStore =  new MongoStore({mongooseConnection: db, collection: 'questions'});
app.post('/admin/addquestion', (req, res, next) => {
  if(req.isAuthenticated()){
    const newQ = new Ques({
      question: req.body.question,
      choices: parseDelimiter(req.body.choices),
      tags: parseDelimiter(req.body.tags),
      rating: req.body.rating,
      answer: parseDelimiter(req.body.answer),
      answer_ex: req.body.answer_ex,
      author: req.body.author,
      type: req.body.type,
      ext_source: req.body.ext_source,
      subject: req.body.subject,
      units: req.body.units
    })
    //collection.insertOne({})
    newQ.save();
  }
  else{
    res.redirect("/");
  }
});

//initial ratings set proficiency
app.post('/private/initialRating', (req, res, next) => {
  //req.params.level, req.params.subject
  if(req.isAuthenticated()){
    req.user.rating[req.body.subject.toLowerCase()] = req.body.level;
    db.collection("users").findOneAndUpdate({ username: req.user.username }, {$set: {rating: req.user.rating}});
    res.redirect("/train/" + req.body.subject + "/choose_units");
  }
  else{
    res.redirect("/");
  }
});
// GET ROUTES/webpages

//public
app.get("/", (req, res) => {
  res.render(__dirname + '/views/public/' + 'index.ejs');
});

app.get("/signin", (req, res) => {
  res.render(__dirname + '/views/public/' + 'signin.ejs');
});

app.get("/signup", (req, res) => {
  res.render(__dirname + '/views/public/' + 'signup.ejs');
});

//private
app.get("/homepage", (req, res) => {
  if(req.isAuthenticated()){
    res.render(__dirname + '/views/private/' + 'homepage.ejs');
  }
  else{
    res.redirect("/");
  }
});

app.get("/settings", (req, res) => {
  if(req.isAuthenticated()){
    res.render(__dirname + '/views/private/' + 'settings.ejs');
  }
  else{
    res.redirect("/");
  }
});

app.get("/train", (req, res) => {
  if(req.isAuthenticated()){
    res.render(__dirname + '/views/private/' + 'train.ejs');
  }
  else{
    res.redirect("/");
  }
});

app.get("/train/choose_subject", (req, res) => {
  if(req.isAuthenticated()){
    res.render(__dirname + '/views/private/' + 'train_chooseSubject.ejs', { subjects: subjects.subjectUnitDictionary});
  }
  else{
    res.redirect("/");
  }
})

//checks to see if prof visited before
app.get("/train/:subject/proficiency", (req, res) => {
  if(req.isAuthenticated()){
    if(req.user.rating[req.params.subject.toLowerCase()] == -1){
        req.user.rating[req.params.subject.toLowerCase()] = 0;
        //req.user.save();
        db.collection("users").findOneAndUpdate({ username: req.user.username }, {$set: {rating: req.user.rating}});
        res.render(__dirname + '/views/private/' + 'train_onetime_setProficiency.ejs', { subject: req.params.subject});
    }
    else{
      res.redirect("/train");
    }
  }
  else{
    res.redirect("/");
  }
})

app.get("/train/:subject/choose_units", (req, res) => {
  if(req.isAuthenticated()){
    if(req.user.rating[req.params.subject.toLowerCase()] == -1){ //check to see if redir needed
      res.redirect("/train/"+req.params.subject+"/proficiency"); //ROUTING FIX
    }
    
    else {

      // DO A CHECK HERE, IF NO RATING REDIRECT TO SET PROFICIENCY PAGE BEFORE THIS PAGE
        res.render(__dirname + '/views/private/' + 'train_chooseUnits.ejs', { units: subjects.subjectUnitDictionary[req.params.subject]});

    }
  }
  else{
    res.redirect("/");
  }
})

app.get("/train/:subject/display_question", (req, res) => {
  if(req.isAuthenticated()){
    // PASS IN PARAMETERS BELOW
    //res.render(__dirname + '/views/private/' + 'train_displayQuestion.ejs', { type: type, question: question, choices: choices, source: source, rating: rating});
  }
  else{
    res.redirect("/");
  }
})

app.get("/train/:subject/answer_explanation", (req, res) => {
  if(req.isAuthenticated()){
    // PASS IN PARAMETERS BELOW
    //res.render(__dirname + '/views/private/' + 'train_answerExplanation.ejs', { PARAMETERS GO HERE });
  }
  else{
    res.redirect("/");
  }
})

app.get("/logout", (req, res) => {
  if(req.isAuthenticated()){
    req.logout();
  }
  res.redirect("/");
});

//admin
            // ADD QUESTION GET ROUTE IS HERE
app.get("/admin/addquestion", (req, res) => {
  if(req.isAuthenticated()&&(req.user.username=="mutorialsproject@gmail.com")){
    res.render(__dirname + '/views/admin/' + 'train_addQuestion.ejs', { subjectUnitDictionary: subjects.subjectUnitDictionary });
  }
  else{
    res.redirect("/");
  }
});

app.get("/admin/addedSuccess", (req, res) => {
  if(req.isAuthenticated()&&(req.user.username=="mutorialsproject@gmail.com")){
    res.render(__dirname + '/views/admin/' + 'train_addQuestionSuccess.ejs');
  }
  else{
    res.redirect("/");
  }
});


//app.use('/user', user); //user path to get to signin/login

app.listen(PORT, (req, res) => {
  console.log(`Server Started at PORT ${PORT}`);
});







// deliminator parsing method is here for now, you can copy it somewhere else to make it all more organized
// input is a string, output is an array of the values
function parseDelimiter(input) {
  return input.split("@");
}
// oops turned out to be more simple than i thought

//console.log(parseDelimiter("I like pie@I dont know@@3@4"));