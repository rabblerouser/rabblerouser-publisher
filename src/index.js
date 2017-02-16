const createPublisher = require('./publisher');
const createListener = require('./listener');

const createClient = (settings) => {
  if (!settings) { throw new Error('No settings defined'); }
  if (typeof settings !== 'object') { throw new Error('Settings must be an object'); }

  const publish = createPublisher(settings);
  const { on, listen } = createListener(settings);

  return { publish, on, listen };
};

module.exports = createClient;
