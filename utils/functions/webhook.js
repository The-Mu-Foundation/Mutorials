const fetch = require('node-fetch')

module.exports = {
    sendDiscordWebhook: (comment) => {
        console.log('hook: ' + comment);
        var params = {
            username: "mutorials.org",
            avatar_url: "",
            content: comment,
        };
        fetch('https://discord.com/api/webhooks/809235980883066891/Te4OwCbAwoXUfKThSndr-TdUzfiONjnA83-6J2mVEGaLKNHIPLlYFYuawNAg9G7XEGZF', {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).then(res => {
            console.log(res);
        });
    }
}

