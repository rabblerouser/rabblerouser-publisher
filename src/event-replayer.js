const AWS = require('aws-sdk');

const replayEvents = (archiveBucket, eventHandler) => {
  const s3 = new AWS.S3();

  const fetchAndReplayObject = ({ Key }) => (
    s3.getObject({ Bucket: archiveBucket, Key }).promise().then(object => {
      const events = object.Body.toString().trim().split('\n');
      events.forEach(event =>
        eventHandler(JSON.parse(JSON.parse(event).data))
      );
    })
  );

  const fetchAndReplayObjects = objects => Promise.all(objects.Contents.map(fetchAndReplayObject));

  const listAndFetchAndReplayObjects = ContinuationToken => {
    return s3.listObjectsV2({ Bucket: archiveBucket, ContinuationToken }).promise().then(objects => (
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
