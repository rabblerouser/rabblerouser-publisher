const createPublisher = require('./publisher');
const createConsumer = require('./consumer');

const createClient = (settings) => {
  const consumer = createConsumer(settings);
  return {
    publish: createPublisher(settings),
    on: consumer.on,
    listen: consumer.listen,
  };
};

module.exports = createClient;
