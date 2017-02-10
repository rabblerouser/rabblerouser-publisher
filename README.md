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
  eventAuthToken, 'some random token',
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

// You can also set up handlers for receiving events of specific types. Notice that we only receive the `data` here.
// Event handlers must return a resolved promise if the event handling succeeded, or a rejected promise if they fail to
// process the event. This will cause the event to re-sent until it succeeds.
streamClient.on('member-registered', data => {
  console.log('Registering a new member called:', data.name);
  return Promise.resolve();
});

// *After* binding all your event handlers, you can then listen for events on an HTTP POST endpoint. You can also
// optionally specify a bucket where historical events should be read from first.
myExpressJsApp.post('/events', streamClient.listen({ archiveBucket: 'my-archive-bucket' }));
```

## API Reference

### `publish`

Accepts an object with a `type` (which must be a non-empty string), and `data` (which must be `JSON.stringify`-able).
Sends a `PutRecord` request to kinesis containing these two fields. Other fields on the event are ignored.

### `on`

Accepts an `eventType` string, and a `handler` function that will be called whenever an event of that type is received.
The `handler` will be passed only the `data` field of the received object (not the type, or any of the metadata), and it
should return a Promise. The resolution of that promise will be used to indicate whether or not the event was processed
successfully. Events that fail to process will be retried again until they succeed. *This may change in the future, see
[this issue](https://github.com/rabblerouser/rabblerouser-core/issues/132) for more discussion of event failures, and
how we might address the problem of invalid events that can never succeed, and would thus clog the stream*

### `listen`

When called, the stream client will then be able to receive events and pass them to handlers. Takes in `options`, which
right now only consists of `archiveBucket`, which specifies the S3 bucket where the client should read historical events
from, before accepting any new events from the stream. If not given, then it will begin listening for new events
immediately.

This function should only be called *after* all `on` calls have been made, so that events do not skip their handlers.

Returns an express.js middleware that should be bound to an HTTP POST endpoint. Incoming requests must have an
`Authorization` header that matches the `eventAuthToken` that was specified when creating the stream client. Request
bodies must have the following structure:

```json
{
  "kinesisSchemaVersion": "1.0",
  "partitionKey": "<kinesis partition key>",
  "sequenceNumber": "<sequence number of the event>",
  "data": "<base64-encoded JSON string>",
  "approximateArrivalTimestamp": 123456.78
}
```

The `data` field will be decoded and parsed, resulting in an event object with `type` and `data` attributes as described
above.

## Demo

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

`npm run demo`
