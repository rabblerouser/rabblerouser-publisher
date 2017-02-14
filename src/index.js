const createPublisher = require('./publisher');
const Listener = require('./listener');

const createClient = (settings) => {
  const listener = new Listener(settings);
  return {
    publish: createPublisher(settings),
    on: listener.on,
    listen: listener.listen,
  };
};

module.exports = createClient;
