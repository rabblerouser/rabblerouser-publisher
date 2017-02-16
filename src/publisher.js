const AWS = require('aws-sdk');

const validateEvent = event => {
  if (typeof event.type !== 'string' || event.type.length === 0) {
    throw new Error('Invalid event type')
  }

  if (!event.data) {
    throw new Error('No event data defined.')
  }
}

const publish = (kinesis, streamName) => event => {
  validateEvent(event);

  return kinesis.putRecord({
    Data: JSON.stringify({ type: event.type, data: event.data }),
    PartitionKey: event.type,
    StreamName: streamName,
  }).promise();
};

const createPublisher = settings => {
  if(!settings.publishToStream) {
    // It's ok to not specify a stream - you just won't be able to publish events
    return () => { throw new Error('Cannot publish an event - stream client was configured without publishToStream') };
  }
  // If you *do* specify a stream, then you also need these settings
  if (!settings.region) { throw new Error('Settings contains a stream but no region'); }
  if (!settings.accessKeyId) { throw new Error('Settings contains a stream but no accessKeyId'); }
  if (!settings.secretAccessKey) { throw new Error('Settings contains a stream but no secretAccessKey'); }

  const kinesis = new AWS.Kinesis({
    apiVersion: '2013-12-02',
    region: settings.region,
    accessKeyId: settings.accessKeyId,
    secretAccessKey: settings.secretAccessKey,
    endpoint: settings.kinesisEndpoint,
  });
  return publish(kinesis, settings.publishToStream);
};

module.exports = createPublisher;
