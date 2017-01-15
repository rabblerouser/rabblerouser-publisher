//TODO: Design this so different streams technologies can be plugged in at some point(like nodemailer).

module.exports = {
  producer: require('./producer'),
  consumer: require('./consumer'),
};
