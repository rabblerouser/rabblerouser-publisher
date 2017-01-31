# rabblerouser-publisher

Rabble Rouser's simplified event publisher. It pushes events to a kinesis stream.

## Installation

Using npm:
```shell
$ npm i -g npm
$ npm i --save rabblerouser-publisher
```

## Usage

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Then use it like this:

```js
const publisher = require('rabblerouser-publisher');

// Configure with your kinesis settings. See https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#constructor-property
const settings = {
  apiVersion: '2013-12-02',
  region: 'ap-southeast-2',
  accessKeyId: 'ABC123',
  secretAccessKey: 'ABC123',
  stream: 'my-stream',
};
const publish = publisher(settings);

// Each event must have a type. This is used for consumers to decide whether they are
// interested in the event, and it will also be used by kinesis for sharding of events.
var event = {
  type: 'registration',
  data: {
    name: 'Jane Doe'
  }
};

// The publish function returns a Promise.
publish(event)
  .then(result => { ... })
  .catch(error => { ... });
```

### Demo

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Then run this to publish a hard-coded event to a hard-coded stream:

`npm run demo`
