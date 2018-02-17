const AWS = require('aws-sdk');

const replayEvents = (bucketSettings, eventHandler, logger, retryDelay = 500) => {
  const { bucket: Bucket, region, accessKeyId, secretAccessKey, endpoint } = bucketSettings;

  const s3 = new AWS.S3({ region, accessKeyId, secretAccessKey, endpoint });

  const processObjectLine = line => {
    const event = JSON.parse(line);
    return eventHandler(event.sequenceNumber, event.data)
      .catch(error => {
        logger.error(`Handling event failed: ${error}`);
        return new Promise((resolve, reject) => (
          setTimeout(
            () => processObjectLine(line).then(resolve, reject),
            retryDelay
          )
        ));
      });
  };

  // The promise reducing in the next two functions ensures that requests are processed sequentially, not in parallel.
  // It makes sure that each request is only handled after the previous one, and then sets itself as current.
  // This prevents race conditions, especially where network requests or application event handlers are slow.

  const fetchAndReplayObject = Key => {
    return s3.getObject({ Bucket, Key }).promise().then(object => {
      logger.info(`Fetched object: ${Key}`);
      const objectLines = object.Body.toString().trim().split('\n');

      return objectLines.reduce((promise, line) => (
        promise.then(() => processObjectLine(line))
      ), Promise.resolve());
    })
  };

  const fetchAndReplayObjects = objects => (
    objects.Contents.reduce((promise, object) => (
      promise.then(() => fetchAndReplayObject(object.Key))
    ), Promise.resolve())
  );

  const listAndFetchAndReplayObjects = ContinuationToken => {
    return s3.listObjectsV2({ Bucket, ContinuationToken }).promise().then(objects => {
      logger.info(`Got list of bucket objects: [${objects.Contents.map(object => object.Key)}]`);
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

  logger.info(`Replaying events from bucket: ${Bucket}`);
  return listAndFetchAndReplayObjects();
};



module.exports = { replayEvents };
