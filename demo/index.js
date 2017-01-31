'use strict';

const publisher = require('../');
const publishToRabbleRouserStream = publisher({ region: 'ap-southeast-2', stream: 'rabblerouser_stream' });

var event = {
  type: 'registration',
  data: {
    name: 'Jane Doe'
  }
};

publishToRabbleRouserStream(event)
  .then(console.log)
  .catch(console.log);
