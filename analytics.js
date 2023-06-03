const mongo = require('./utils/functions/mongo.js');

//record daily and weekly user growth
async function collectDailyData() {
    let currentUsers = await mongo.db.collection('users').countDocuments({});
    let history = await mongo.SiteData.findOne({ tag: "HISTORY" }).exec();
    history.data.userbase_month.push(currentUsers);
    if (history.data.userbase_month.length > 30) {
        history.data.userbase_month.shift();
    }
    else {
        while (history.data.userbase_month.length < 30) {
            history.data.userbase_month.push(currentUsers);
        }
    }
    await mongo.SiteData.updateOne({ tag: "HISTORY" }, { $set: { data: history.data } }).exec();
    triggerAnalytics();
}

async function collectWeeklyData() {
    let currentUsers = await mongo.db.collection('users').countDocuments({});
    let history = await mongo.SiteData.findOne({ tag: "HISTORY" }).exec();
    history.data.userbase_year.push(currentUsers);
    if (history.data.userbase_year.length > 52) {
        history.data.userbase_year.shift();
    }
    else {
        while (history.data.userbase_year.length < 52) {
            history.data.userbase_year.push(currentUsers);
        }
    }
    await mongo.SiteData.updateOne({ tag: "HISTORY" }, { $set: { data: history.data } }).exec();
    collectDailyData();
}

function triggerAnalytics() {
    let time = Date.now(), day = 24 * 60 * 60 * 1000, week = 7 * 24 * 60 * 60 * 1000;
    if (week - time % week == day - time % day) {
        setTimeout(collectWeeklyData, week - time % week);
    }
    else {
        setTimeout(collectDailyData, day - time % day);
    }
}

module.exports = {
    triggerAnalytics
}