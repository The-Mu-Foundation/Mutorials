# ved's todo list
- reset password
- db fields length checking
- limit on login tries
- reloading answer explanation page adds correct/wrong count to server again
- db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: { correct: req.user.stats.correct, wrong: req.user.stats.wrong, collectedTags: req.user.stats.collectedTags, ratingTracker: req.user.stats.ratingTracker } } });

