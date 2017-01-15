//TODO: Design this so different streams technologies can be plugged in at some point(like nodemailer).

const producer = require('./aws/producer');
const consumer = require('./aws/consumer');

module.exports = {
  producer: producer,
  consumer: consumer,
};
