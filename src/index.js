const publisher = require('./publisher');
const consumer = require('./consumer');

const createClient = (settings) => ({
  publish: publisher(settings),
  consumer,
});

module.exports = createClient;
