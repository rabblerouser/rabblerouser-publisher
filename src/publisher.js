const AWS = require('aws-sdk');

const validate = (eventType, eventData) => {
  if (typeof eventType !== 'string' || eventType.length === 0) {
    throw new Error('Invalid eventType')
  }

  if (!eventData) {
    throw new Error('Missing eventData')
  }
}

const publish = (kinesis, streamName) => (eventType, eventData) => {
  validate(eventType, eventData);

  return kinesis.putRecord({
    Data: JSON.stringify({ type: eventType, data: eventData }),
    PartitionKey: eventType,
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
