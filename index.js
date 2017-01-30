const AWS = require('aws-sdk');

module.exports = (settings) => {
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
