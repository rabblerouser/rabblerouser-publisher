'use strict';

const stream = require('../');

var params = {
  data: 'I am a harmless little event',
  channel: 'registration',
  stream: 'rabble-rouser-main-stream'
};

stream.producer.publish(params).then(console.log).catch(console.log);
