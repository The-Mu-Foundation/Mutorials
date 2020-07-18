
const mongoose = require("mongoose");
const MONGOURI = "mongodb+srv://Skippy:PNSwim19@cluster0-7gibd.mongodb.net/mutorialsone?retryWrites=true&w=majority";
// Test database URI: "mongodb+srv://Skippy:PNSwim19@cluster0-7gibd.mongodb.net/test?retryWrites=true&w=majority"
// Public database URI: "mongodb+srv://Skippy:PNSwim19@cluster0-7gibd.mongodb.net/mutorialsone?retryWrites=true&w=majority"

const InitiateMongoServer = async () => {
    try{
        await mongoose.connect(MONGOURI, {
            useNewUrlParser: true
        });
    console.log("Connected to the database!");
    } catch (e) {
        console.log(e);
        throw e;
    }
};
module.exports = InitiateMongoServer;
