const createPublisher = require('./publisher');
const Consumer = require('./consumer');

const createClient = (settings) => {
  const consumer = new Consumer(settings);
  return {
    publish: createPublisher(settings),
    on: consumer.on,
    listen: consumer.listen,
  };
};

module.exports = createClient;
