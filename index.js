const AWS = require('aws-sdk');

module.exports = (settings) => {
  const kinesis = new AWS.Kinesis({
    apiVersion: settings.version || '2013-12-02',
    region: settings.region || 'ap-southeast-2',
  });

  return (event) => {
    const awsParams = {
      Data: JSON.stringify(event),
      PartitionKey: event.type,
      StreamName: settings.stream,
    };

    return kinesis.putRecord(awsParams).promise();
  };
}
