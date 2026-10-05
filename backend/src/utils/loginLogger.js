const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const logDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = createLogger({
  level: 'info',

  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),

  transports: [
    new transports.Console(),

    new transports.File({
      filename: path.join(logDir, 'login.log')
    })
  ]
});

module.exports = logger;