// SETUP

var express                 = require("express");
var expressSession          = require("express-session");
var mongoose                = require("mongoose");
var passport                = require("passport");
var bodyParser              = require("body-parser");
var User                    = require("./models/user");
var LocalStrategy           = require("passport-local");
var passportLocalMongoose   = require("passport-local-mongoose");

mongoose.connect("mongodb://localhost/mutorials");

var app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressSession({
    secret: "My favorite trainer is Mutorials",
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

//passport.use(new LocalStrategy(User.authenticate()));
passport.use(new LocalStrategy({
    usernameField: "email",
    passwordField: "password" },
    function(email, password, done) {
        /*User.findOne({ 'local.email' :  email }, function(err, user) {
            if (err) {
              return done(err); }
            if (!user) {
              return done(null, false, { message: "No username is found to match your input"}); }
            if (!user.validPassword(password)) {
              return done(null, false, { message: "Wrong password"}); }
            return done(null, user);
        });*/
    }));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const port = 3000;









// post routes
app.post("/signup", function(req, res) {
    User.register(new User({email: req.body.signupEmail, username: req.body.signupUsername}), req.body.signupPassword, function(err, user) {
        if(err) {
            console.log(err);
            return res.render(__dirname + "/views/" + "index.ejs");
        }
        passport.authenticate("local")(req, res, function() {
            res.redirect("/home");
        });
    });
});
app.post("/login", passport.authenticate("local", {
    successRedirect: "/home",
    failureRedirect: "/"/*,
failureFlash: true*/}), function(req, res) { 

        console.log("hello world 2");
        console.log(req.body.email);
        console.log(req.body.password);
    });



// get routes
app.get('/', (req, res) => {
    res.render(__dirname + "/views/" + "index.ejs");
   /* if (req.user) {
        console.log('yay logged in as admin');
        res.render(__dirname + '/views/' + 'homepage.ejs');
    } else {
        console.log('nope, not logged in!')
        res.render(__dirname + '/views/' + 'index.ejs');
    }*/
});
app.get("/home", function(req, res) {
    res.render(__dirname + "/views/" + "homepage.ejs");
});
app.route('/settings')
    .get((req, res) => {
        passport.authenticate('local', { failureRedirect: '/', failureFlash: true, session: true });
        res.render(__dirname + '/views/' + 'settings.ejs');
    })
    ;
app.route('/train')
    .get((req, res) => {
        console.log(req.user);
        passport.authenticate('local', { failureRedirect: '/', failureFlash: true, session: true });
        res.render(__dirname + '/views/' + 'train.ejs');
    })
    ;
app.route('/train/choose_subject')
    .get((req, res) => {
        passport.authenticate('local', { failureRedirect: '/', failureFlash: true, session: true });
        res.render(__dirname + '/views/' + 'train_chooseSubject.ejs', { subjects: ['cooking', 'eating', 'sleeping'] })
    })
    ;
app.route('/train/choose_units')
    .get((req, res) => {
        passport.authenticate('local', { failureRedirect: '/', failureFlash: true, session: true });
        res.render(__dirname + '/views/' + 'train_chooseUnits.ejs', {units: ['talking', 'working', 'procrastinating', 'off taskness', 'adding to this list instead of coding']});
    })
    ;
app.route('/train/question')
    .get((req, res) => {
        passport.authenticate('local', { failureRedirect: '/', failureFlash: true, session: true });
        res.render(__dirname + '/views/' + 'train_displayQuestion.ejs', {type: "fr", question: "Andy bought 172 rolls of toilet paper. He ate 21 of them. How many are left?", choices: []});
    })
    ;







app.listen(port, function() {
    console.log("Mutorials started on port " + port);
});









// problems stuff
/*
function addProblem(name, question, answer_choices, correct_answer, rating, subject, subtopic) {
    console.log("adding problem");
    return client.query("INSERT INTO problems(name, question, answer_choices, correct_answer, rating, subject, subtopic) VALUES($1, $2, $3, $4, $5, $6, $7);", [name, question, answer_choices, correct_answer, rating, subject, subtopic]).rows[0];
}

function getProblemById(id) {
    console.log("getting problem by id: ", id);
    return client.query("SELECT * FROM problems WHERE id=$1;", [id]).rows[0];
}

function getRandomProblemBySubtopic(subject, subtopic) {
    console.log("getting problem by subtopic: ", subject, subtopic);
    return client.query("SELECT * FROM problems WHERE subject=$1 AND subtopic=$2;", [subject, subtopic]).then((result) => {
        
    });
}*/