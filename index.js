const express = require('express');
const path = require('path');
const chalk = require('chalk'); // for colorful console
const app = express();

const pairCode = require('./pair');

const PORT = process.env.PORT || 8001;
__path = process.cwd();

require('events').EventEmitter.defaultMaxListeners = 500;

// Use pair.js under /code
app.use('/code', pairCode);

// Serve pair.html at root
app.use('/', (req, res) => res.sendFile(__path + '/pair.html'));

// Server Start
app.listen(PORT, () => {
  console.log(chalk.green.bold("✅ ADEEL-MD Server Started Successfully!"));
  console.log(chalk.cyan(`🌐 Running at: http://localhost:${PORT}`));
  console.log(chalk.yellow("📡 Channel JID: 0029Vb6HUGv0G0XmD5RKrA3G@newsletter"));
  console.log(chalk.magenta("📂 Repo: https://github.com/prince009here/ADEEL-MD"));
});

module.exports = app;