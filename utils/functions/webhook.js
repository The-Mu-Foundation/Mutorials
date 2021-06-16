const fetch = require('node-fetch');

module.exports = {
    sendDiscordWebhook: (comment, username, ign, questionId) => {
        let value = "";
        if (questionId) {
            value = "Question ID: " + questionId + "\n" + comment;
        } else {
            value = comment;
        }
        console.log('hook: ' + value);
        const params = {
            username: "mutorials.org",
            avatar_url: "",
            embeds: [
                {
                    "title": ign,
                    "color": 3650267,
                    "fields": [
                        {
                            "name": username,
                            "value": value
                        }
                    ]
                }
            ]
        };
        const url = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/809235980883066891/Te4OwCbAwoXUfKThSndr-TdUzfiONjnA83-6J2mVEGaLKNHIPLlYFYuawNAg9G7XEGZF';
        fetch(url, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        }).then(res => {
            console.log(res);
        });
    }
}

