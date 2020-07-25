# ved's todo list
- reset password
- db fields length checking
- page cache
- limit on login tries
- db.collection("users").findOneAndUpdate({ username: req.user.username }, { $set: { stats: { correct: req.user.stats.correct, wrong: req.user.stats.wrong, collectedTags: req.user.stats.collectedTags, ratingTracker: req.user.stats.ratingTracker } } });

