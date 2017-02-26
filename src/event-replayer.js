const AWS = require('aws-sdk');

const replayEvents = (bucketSettings, eventHandler) => {
  const { bucket: Bucket, region, accessKeyId, secretAccessKey, endpoint } = bucketSettings;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey, endpoint });

  const handleEvent = event => {
    const parsedEvent = JSON.parse(event);
    const eventData = JSON.parse(parsedEvent.data)
    return eventHandler(parsedEvent.sequenceNumber, eventData)
      .catch(error => {
        process.env.NODE_ENV !== 'test' && console.log('Handling event failed:', error);
        return handleEvent(event);
      });
  };

  const fetchAndReplayObject = ({ Key }) => (
    s3.getObject({ Bucket, Key }).promise().then(object => {
      const events = object.Body.toString().trim().split('\n');
      return Promise.all(events.map(handleEvent));
    })
  );

  const fetchAndReplayObjects = objects => Promise.all(objects.Contents.map(fetchAndReplayObject));

  const listAndFetchAndReplayObjects = ContinuationToken => {
    return s3.listObjectsV2({ Bucket, ContinuationToken }).promise().then(objects => (
      fetchAndReplayObjects(objects).then(() => {
        if (objects.IsTruncated) {
          // There are more objects still in the bucket, recurse to the next lot
          return listAndFetchAndReplayObjects(objects.NextContinuationToken);
        }
        // We've exhausted the bucket, end the chain
        return Promise.resolve();
      })
    ));
  };

  return listAndFetchAndReplayObjects();
};



module.exports = { replayEvents };
