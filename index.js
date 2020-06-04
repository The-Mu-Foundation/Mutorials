const mongoose = require('mongoose'); 
const express = require("express");
const bodyParser = require("body-parser");
const user = require("./routes/user");
const InitiateMongoServer = require("./config/db");
const auth = require("./middleware/auth");
var db = mongoose.connection;

// start server
InitiateMongoServer();

const app = express();

//port
const PORT = process.env.PORT || 3000;

//middleware
//app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.get("/", (req, res) => {
  res.json({ message: "API Working" });
});

app.get("/homepage", (req, res) => {
  res.render(__dirname + '/views/' + 'homepage.ejs');
});

app.get("/train", auth, (req, res) => {
  
  res.render(__dirname + '/views/' + 'train.ejs');
});

app.get("/settings", (req, res) => {
  res.render(__dirname + '/views/' + 'settings.ejs');
});

app.get("/AdminAdd", (req, res) => {
  res.render(__dirname + '/views/' + 'train_admin_addQuestion.ejs');
});

app.get("/signup", (req, res) => {
  res.render(__dirname + '/views/' + 'index.ejs');
});
/*
app.post('/user', function(req,res){ 
  var username = req.body.username; 
  var email =req.body.email; 
  var password = req.body.password; 
  //var phone =req.body.phone; 

  var data = { 
      "username": username, 
      "email":email, 
      "password":password, 
      //"phone":phone 
  } 
  db.collection('test.users').insertOne(data,function(err, collection){ 
      if (err) throw err; 
      console.log("Record inserted Successfully"); 
            
  }); 
        
  return res.redirect('./views/train.ejs'); 
}) 
*/
app.use('/user', user); //user path to get to signin/login

app.listen(PORT, (req, res) => {
  console.log(`Server Started at PORT ${PORT}`);
});
