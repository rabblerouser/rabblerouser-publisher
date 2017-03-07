const AWS = require('aws-sdk');

const replayEvents = (bucketSettings, eventHandler) => {
  const { bucket: Bucket, region, accessKeyId, secretAccessKey, endpoint } = bucketSettings;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey, endpoint });

  const processObjectLine = line => {
    const event = JSON.parse(line);
    return eventHandler(event.sequenceNumber, event.data)
      .catch(error => {
        process.env.NODE_ENV !== 'test' && console.error('Handling event failed:', error);
        return processObjectLine(line);
      });
  };

  let promise = Promise.resolve();
  const fetchAndReplayObject = ({ Key }) => (
    s3.getObject({ Bucket, Key }).promise().then(object => {
      process.env.NODE_ENV !== 'test' && console.log(`Fetched object: ${Key}`);
      const objectLines = object.Body.toString().trim().split('\n');

      objectLines.forEach(line => {
        // This strange promise looping ensures that the events are processed in sequence, not in parallel.
        // It makes sure that the current event isn't handled until after the previous one, and sets itself as current.
        promise = promise.then(() => processObjectLine(line));
      });
      return promise;
    })
  );

  const fetchAndReplayObjects = objects => Promise.all(objects.Contents.map(fetchAndReplayObject));

  const listAndFetchAndReplayObjects = ContinuationToken => {
    return s3.listObjectsV2({ Bucket, ContinuationToken }).promise().then(objects => {
      process.env.NODE_ENV !== 'test' &&
        console.log(`Got list of bucket objects: [${objects.Contents.map(object => object.Key)}]`);
      return fetchAndReplayObjects(objects).then(() => {
        if (objects.IsTruncated) {
          // There are more objects still in the bucket, recurse to the next lot
          return listAndFetchAndReplayObjects(objects.NextContinuationToken);
        }
        // We've exhausted the bucket, end the chain
        return Promise.resolve();
      });
    });
  };

  process.env.NODE_ENV !== 'test' && console.log(`Replaying events from bucket: ${Bucket}`);
  return listAndFetchAndReplayObjects();
};



module.exports = { replayEvents };
