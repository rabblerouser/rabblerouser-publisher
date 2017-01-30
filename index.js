//TODO: Design this so different streams technologies can be plugged in at some point(like nodemailer).

const producer = require('./aws/producer');

module.exports = { producer };
