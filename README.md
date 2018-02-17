# Rabble Rouser Stream Client

[![Build Status](https://travis-ci.org/rabblerouser/stream-client.svg?branch=master)](https://travis-ci.org/rabblerouser/stream-client)

Rabble Rouser's kinesis stream client. It publishes and listens for events.

## Installation

```sh
npm install --save @rabblerouser/stream-client
```

## Usage

```js
const createClient = require('@rabblerouser/stream-client');

// This is the complete config, not everything is required (see API reference below)
const streamClient = createClient({
  publishToStream: 'my-stream',
  listenWithAuthToken: 'some random token',
  readArchiveFromBucket: 'my-bucket',
  region: 'ap-southeast-2',
  accessKeyId: 'ABC123',
  secretAccessKey: 'ABC123',
  kinesisEndpoint: 'http://kinesis:1234',
  s3Endpoint: 'http://s3:1234',
});

// Publish an event: The first parameter is the `eventType`, which is used for listeners
// to decide whether they are interested in the event, and it will also be used by
// kinesis for sharding of events. The second parameter is the `eventData`, which is what
// listeners will ultimately receive.
streamClient.publish('member-registered', { name: 'Jane Doe' })
  .then(result => { ... })
  .catch(error => { ... });

// Set up a handler for events of specific types. Notice that we only receive
// the `data` here. Event handlers must return a resolved promise if the event
// handling succeeded, or a rejected promise if they fail to process the event.
// This will cause the event to be re-sent until it succeeds.
streamClient.on('member-registered', data => {
  console.log('Registering a new member called:', data.name);
  return Promise.resolve();
});

// *After* binding all event handlers, start listening for POSTed events.
myExpressJsApp.post('/events', streamClient.listen());
```

## You need an event forwarder

This library does not directly pull events from kinesis, because Amazon recommend you use a dedicated thread for that,
which is not really possible with Node.js. This library just helps you create a listener for events that are sent to
your application via HTTP POST. If you want the listener to be useful, you need something else that polls the kinesis
stream, and sends you those HTTP requests. That is what [event-forwarder](https://github.com/rabblerouser/event-forwarder)
does. See its readme for more details.

## API Reference

### `createClient(settings)`

Creates a new streamClient object. All settings are optional, depending on how you want to use the created client:
- `publishToStream` (*string*): The name of the kinesis stream where you want to publish events. Required if you want to
be able to publish events.
- `listenWithAuthToken` (*string*): The secret token that will be used to authenticate incoming events. Required if you
want to bind any event handlers, or listen for events.
- `readArchiveFromBucket` (*string*): The S3 bucket where events will be read from before accepting events from the
 stream. If not given, then you will only receive new events, not historical ones.
- `region` (*string*): The region where your kinesis stream and/or S3 bucket are located. Required if either `publishToStream` or `readArchiveFromBucket` are given.
- `accessKeyId` (*string*): The AWS access key for your kinesis stream and/or S3 bucket. Required if either `publishToStream` or `readArchiveFromBucket` are given.
- `secretAccessKey` (*string*): The AWS secret key for your kinesis stream and/or S3 bucket. Required if either `publishToStream` or `readArchiveFromBucket` are given.
- `kinesisEndpoint` (*string*): The endpoint to send kinesis requests to. Useful for developing with e.g. kinesalite.
- `s3Endpoint` (*string*): The endpoint to send S3 requests to. Useful for developing with e.g. fake-s3.
- `logger` (*object*): A logger object with the methods `info`, `warn`, and `error`. Defaults to the standard JavaScript console object.

Returns a `streamClient` object with the following methods:

### `streamClient.publish(eventType, eventData)`

- `eventType` (*string*): The type of the event.
- `eventData` (*object*): The event payload. (Technically it can be anything JSON.stringify-able)

### `streamClient.on(type, handler)`

Registers a handler for a particular event type. Note that events won't start coming through until you call `listen()`.
- `type` (*string*): The type of event to listen for.
- `handler` (*function(`data`)*): The function that will receive the events.
  - `data` (*object*): The original payload, without the type or any other metadata.
  - *Returns*: It must return a Promise, whose resolution indicates whether the event was handled successfully. Failed
  events will be retried again until they succeed. *(This may change in the future, see [here](https://github.com/rabblerouser/core/issues/132)
  for more discussion of event failures, and how we might address the problem of invalid events that can never succeed, which would clog the stream)*

### `streamClient.listen()`

Makes the client start processing events. If an archive bucket was specified when creating the client, then it will
iterate through historical events first. After that it will start processing new events coming in from the stream.
This function should only be called *after* all `on` calls have been made, so that events do not miss their handlers.

*Returns*: an express.js middleware that should be bound to an HTTP POST endpoint. Requests must have an `Authorization`
header that matches the auth token that was specified when creating the stream client. Request bodies must have the
following structure:

```json
{
  "kinesisSchemaVersion": "1.0",
  "partitionKey": "<kinesis partition key>",
  "sequenceNumber": "<sequence number of the event>",
  "data": "<base64-encoded JSON string>",
  "approximateArrivalTimestamp": 123456.78
}
```

The `data` field, when decoded and parsed, must contain an event object with `type` and `data` attributes as described above.

## Publishing this library

Scoped packages (which this is) are private by default on npm, which is a paid feature. To publish publicly, use this command:

```sh
npm publish --access=public
```
