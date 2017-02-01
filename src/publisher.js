const AWS = require('aws-sdk');

const validateSettings = settings => {
  if (!settings) {
    throw new Error('No settings defined.');
  }

  if (!settings.stream) {
    throw new Error('No stream defined.');
  }
}

const validateEvent = event => {
  if (!event.type) {
    throw new Error('No event type defined.')
  }

  if (!event.data) {
    throw new Error('No event data defined.')
  }
}

const publisher = (settings) => {
  validateSettings(settings);

  const kinesis = new AWS.Kinesis(settings);

  return (event) => {
    validateEvent(event);

    const awsParams = {
      Data: JSON.stringify(event),
      PartitionKey: event.type,
      StreamName: settings.stream,
    };

    return kinesis.putRecord(awsParams).promise();
  };
};

module.exports = publisher;
