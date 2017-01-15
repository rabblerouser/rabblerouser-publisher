'use strict';
const AWS = require('aws-sdk');
const kinesis = new AWS.Kinesis({
  apiVersion: '2013-12-02',
  region: 'ap-southeast-2',
});

function publish(event) {
  var awsParams = {
    Data: event.data,
    StreamName: event.stream,
    PartitionKey: event.channel,
  };

  return kinesis.putRecord(awsParams).promise()
  .then(processResult)
  .catch(handleError);
}

function processResult(result) {
  return {
    result: result
  };
}

function handleError(error) {
  throw Error(error);
}

module.exports = {
  publish: publish
};
