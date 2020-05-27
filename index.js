const express = require("express");
const bodyParser = require("body-parser");
const user = require("./routes/user");
const InitiateMongoServer = require("./config/db")


// start server
InitiateMongoServer();

const app = express();

//port
const PORT = process.env.PORT || 3000;

//middleware
app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.json({ message: "API Working" });
});

app.get("/homepage", (req, res) => {
  res.render(__dirname + '/views/' + 'homepage.ejs');
});

app.get("/train", (req, res) => {
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

app.use('/user', user); //user path to get to signin/login

app.listen(PORT, (req, res) => {
  console.log(`Server Started at PORT ${PORT}`);
});
