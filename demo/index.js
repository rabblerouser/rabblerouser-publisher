'use strict';

const publisher = require('../');

const publish = publisher({ region: 'ap-southeast-2', stream: 'rr-stream' });

var event = {
  type: 'registration',
  name: 'Jane Doe',
};

publish(event)
  .then(console.log)
  .catch(console.log);
