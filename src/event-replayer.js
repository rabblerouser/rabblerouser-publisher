const AWS = require('aws-sdk');

const replayEvents = (bucketSettings, eventHandler, retryDelay = 500) => {
  const { bucket: Bucket, region, accessKeyId, secretAccessKey, endpoint } = bucketSettings;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey, endpoint });

  const processObjectLine = line => {
    const event = JSON.parse(line);
    return eventHandler(event.sequenceNumber, event.data)
      .catch(error => {
        process.env.NODE_ENV !== 'test' && console.error('Handling event failed:', error);
        return new Promise((resolve, reject) => (
          setTimeout(
            () => processObjectLine(line).then(resolve, reject),
            retryDelay
          )
        ));
      });
  };

  // The promise looping in the next two functions ensures that requests are processed sequentially, not in parallel.
  // It makes sure that each request is only handled after the previous one, and then sets itself as current.
  // This prevents race conditions, especially where network requests or application event handlers are slow.

  const fetchAndReplayObject = Key => {
    let promise = Promise.resolve();
    return s3.getObject({ Bucket, Key }).promise().then(object => {
      process.env.NODE_ENV !== 'test' && console.log(`Fetched object: ${Key}`);
      const objectLines = object.Body.toString().trim().split('\n');

      objectLines.forEach(line => {
        promise = promise.then(() => processObjectLine(line));
      });
      return promise;
    })
  };

  const fetchAndReplayObjects = objects => {
    let promise = Promise.resolve();
    objects.Contents.forEach(object => {
      promise = promise.then(() => fetchAndReplayObject(object.Key));
    })
    return promise;
  };

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
