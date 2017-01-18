'use strict';

const stream = require('../');

var params = {
  data: 'we are streaming events',
  channel: 'registration',
  stream: 'dan-pam-stream-keep-away'
};

stream.producer.publish(params).then(console.log).catch(console.log);
