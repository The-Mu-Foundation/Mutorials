const express = require("express");
const { check, validationResult} = require("express-validator/check");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/User");
//sign up
router.post(
    "/signup",
    [
        check("username", "Please enter a Valid Username")
        .not()
        .isEmpty(),
        check("email", "Please enter a valid email").isEmail(),
        check("password", "Please enter a valid password").isLength({
            min: 4
        })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if(!errors.isEmpty()){
            return res.status(400).json({
                errors: errors.array()
            })
        }

        const{
            username,
            email,
            password
        } = req.body;
        try {
            let User = await User.findOne({
                email
            })
            if(user){
                return res.status(400).json({
                    msg: "User already exists"
                })
            }
            user = new User({
                username,
                email,
                password
            });
            const salt = await bCrypt.genSalt(10);
            user.password = await bCrypt.hash(password, salt);

            await user.save();
            const payload = {
                user: {
                    id: user.id
                }
            };
            jwt.sign(
                payload,
                "randomString",{
                    expiresIn: 10000
                },
                (err, token) => {
                    if (err) throw err;
                    res.status(200).json({
                        token
                    });
                }

            );

        } catch (err) {
            console.log(err.message);
            res.status(500).send("Error in Saving");
        }
    }

);
module.exports = router;
//login
router.post(
    "/login",
    [
      check("email", "Please enter a valid email!").isEmail(),
      check("password", "Please enter a valid password!").isLength({
          min: 4
      })  
    ],
    async(req,res) => {
        const errors = validationResult(req);

        if(!errors.isEmpty()) {
            return res.status(400).json({
                errors: errors.array()
            });
        }

        const {email, password} = req.body;
        try{
            let user = await User.findOne({
                email
            });
            if(!user)
                return res.status(400).json({
                    message: "User does not exist"
                });
            
            const isMatch = await bCrypt.compare(password, user.password);
            if(!isMatch)
                return res.status(400).json({
                    message: "Incorrect Password! Try again!"
                });
                
            const payload = {
                user: {
                    id: user.id
                }
            };

            jwt.sign(
                payload,
                "random string",
                {
                    expiresIn: 3600
                },
                (err, token) => {
                    if (err) throw err;
                    res.status(200).json({
                        token
                    });
                }
            );
        } catch (e) {
            console.error(e);
            res.status(500).json({
                message: "Server Error"
            });
        }
    }
);