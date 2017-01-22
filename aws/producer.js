'use strict';
const AWS = require('aws-sdk');

function processResult(result) {
  return {
    result: result
  };
}

function handleError(error) {
  throw Error(error);
}

module.exports = function (settings) {
  const kinesis = new AWS.Kinesis({
    apiVersion: settings.version || '2013-12-02',
    region: settings.region || 'ap-southeast-2',
  });

  let thisProducer = {};

  thisProducer.publish = (event) => {
    var awsParams = {
      Data: event.data,
      PartitionKey: event.channel,
      StreamName: settings.stream,
    };

    return kinesis.putRecord(awsParams).promise()
    .then(processResult)
    .catch(handleError);
  };

  return thisProducer;
}
