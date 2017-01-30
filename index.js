const AWS = require('aws-sdk');

function validateSettings(settings) {
  if (!settings) {
    throw Error('No publisher settings defined.');
  }

  if (!settings.stream) {
    throw Error('No stream defined.');
  }
}

module.exports = (settings) => {
  validateSettings(settings);

  const kinesis = new AWS.Kinesis(settings);

  return (event) => {
    const awsParams = {
      Data: JSON.stringify(event),
      PartitionKey: event.type,
      StreamName: settings.stream,
    };

    return kinesis.putRecord(awsParams).promise();
  };
}
