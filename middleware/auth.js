//middleware auth use in route.js
//checks login token, know when redirect to login
const jwt = require("jsonwebtoken");

module.exports = function(req, res, next){
    const token = req.header("token");
    if(!token) {
        res.redirect("/signup");
    }

    try {
        const decoded = jwt.verify(token, "randomString");
        req.user = decoded.user;
        next();
    } catch (e) {
        console.error(e);
        res.redirect("/signup");
    }
    //add redirect here
};