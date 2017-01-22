'use strict';

const stream = require('../');

const producer = stream.producer({
  stream: 'dan-pam-stream-keep-away',
  region: 'ap-southeast-2',
});

var params = {
  data: 'we are streaming events',
  channel: 'registration',
};

producer.publish(params)
.then(console.log)
.catch(console.log);
