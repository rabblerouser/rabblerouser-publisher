const AWS = require('aws-sdk');

const replayEvents = (bucketSettings, eventHandler) => {
  const { bucket: Bucket, region, accessKeyId, secretAccessKey, endpoint } = bucketSettings;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey, endpoint });

  const handleEvent = event => {
    const parsedEvent = JSON.parse(event);
    const eventData = JSON.parse(parsedEvent.data);
    return eventHandler(parsedEvent.sequenceNumber, eventData)
      .catch(error => {
        process.env.NODE_ENV !== 'test' && console.log('Handling event failed:', error);
        return handleEvent(event);
      });
  };

  let promise = Promise.resolve();
  const fetchAndReplayObject = ({ Key }) => (
    s3.getObject({ Bucket, Key }).promise().then(object => {
      const events = object.Body.toString().trim().split('\n');

      events.forEach(event => {
        // This strange promise looping ensures that the events are processed in sequence, not in parallel.
        // It makes sure that the current event isn't handled until after the previous one, and sets itself as current.
        promise = promise.then(() => handleEvent(event));
      });
      return promise;
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
