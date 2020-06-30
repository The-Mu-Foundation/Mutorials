//token to get logged in user

import { Router } from "express";

Router.get("/me", auth, async(req, res) => {
    try {
        //after token auth user is getting fetched
        const user = await user.findById(req.user.id);
        res.json(user);
    } catch (e) {
        res.send({ message: "Error in fetching user"})
    }
});