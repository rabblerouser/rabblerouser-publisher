# rabblerouser-stream-client

Rabble Rouser's kinesis stream client. It publishes and consumes events.

## Installation

Using npm:
```shell
$ npm i -g npm
$ npm i --save rabblerouser-stream-client
```

## Usage

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Then use it like this:

```js
const createClient = require('rabblerouser-stream-client');

// Configure with your kinesis settings. See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#constructor-property
const settings = {
  apiVersion: '2013-12-02',
  region: 'ap-southeast-2',
  accessKeyId: 'ABC123',
  secretAccessKey: 'ABC123',
  stream: 'my-stream',
};
const streamClient = createClient(settings);

// Each event must have a `type`. This is used for consumers to decide whether they are
// interested in the event, and it will also be used by kinesis for sharding of events.
// The event can also have `data`, which is what consumers will ultimately receive.
var event = {
  type: 'member-registered',
  data: {
    name: 'Jane Doe'
  }
};

// You can use the stream client to publish events. The publish function returns a Promise
streamClient.publish(event)
  .then(result => { ... })
  .catch(error => { ... });

// You can also receive events using a middleware. You would typically bind this to an HTTP endpoint
myExpressJsApp.post('/events', streamClient.consumer);

// Then you can set up specific handlers for specific event types. Notice that we only receive the `data` here.
streamClient.consumer.on('member-registered', data => {
  console.log('Registering a new member called:', data.name);
});
```

### Demo

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

`npm run demo`
