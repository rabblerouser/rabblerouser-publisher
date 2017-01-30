'use strict';

const publisher = require('../');
const publish_to_rr_stream = publisher({ region: 'ap-southeast-2', stream: 'rr-stream' });

var event = {
  type: 'registration',
  data: {
    name: 'Jane Doe'
  }
};

publish_to_rr_stream(event)
  .then(console.log)
  .catch(console.log);
