try {
  require('dotenv').config({ quiet: true });
  console.log('Loaded env vars from .env file.');
} catch {
  console.log(
    'Not in development environment. Skipping loading from .env file.',
  );
}

const http = require('http');
const config = require('./utils/config');
const mongo = require('./utils/functions/mongo.js');
const { ensureSiteData } = require('./utils/functions/database');
const app = require('./app');
const { initializeAnalytics } = require('./analytics');

// last-resort handlers: log and keep the process alive for transient failures
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

mongo.connected
  .then(() => ensureSiteData(mongo.SiteData))
  .then(() => {
    http.createServer(app).listen(config.PORT, () => {
      console.log('Express server listening on port ' + config.PORT);
    });
    initializeAnalytics();
  })
  .catch(() => {
    console.error('Not starting the server: database connection failed.');
    process.exit(1);
  });
