'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const createClient = require('../src');

const streamClient = createClient({ region: 'ap-southeast-2', stream: 'rabblerouser_stream' });
const app = express();
app.use(bodyParser.json());

streamClient.on('member-registered', data => {
  console.log('Registered a new member called:', data.name);
});
app.post('/events', streamClient.listen());

app.post('/register', (req, res) => {
  console.log(req.body);
  const event = {
    type: 'member-registered',
    data: {
      name: req.body.name
    }
  };
  console.log('Publishing this event:', event);
  streamClient.publish(event)
    .then(console.log)
    .catch(console.log);
  res.sendStatus(200);
})

app.listen(3030, function () {
  console.log('App is now listening on port 3030!');
  console.log('');
  console.log('You can send me a registration request like this, and I will put an event on a kinesis stream for you:');
  console.log(`curl -X POST localhost:3030/register -H 'Content-Type: application/json' -d '{ "name": "Jane Doe" }'`);
  console.log('');
  console.log('I will also for events coming off the stream. If you do not have a forwarder set up, you manually send me one like this:');
  console.log(`curl -X POST localhost:3030/events -H 'Content-Type: application/json' -H 'Authorization: secret' -d '{ "type": "member-registered", "data": { "name": "Jane Doe" } }' `)
  console.log('');
});
