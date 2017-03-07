const AWS = require('aws-sdk');
const eventReplayer = require('../event-replayer');

describe('eventReplayer', () => {
  let sandbox;
  let s3;
  const bucketSettings = {
    bucket: 'archive-bucket',
    region: 'ap-southeast-2',
    accessKeyId: 'ABC123',
    secretAccessKey: 'ABC123',
    endpoint: 'http://s3:1234',
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    s3 = {
      listObjectsV2: sinon.stub(),
      getObject: sinon.stub(),
    };
    sandbox.stub(AWS, 'S3').returns(s3);
  });

  afterEach(() => {
    sandbox.restore();
  });

  const awsResponse = data => ({ promise: () => Promise.resolve(data) });

  it('initialises S3 with the right settings', () => {
    s3.listObjectsV2.returns(awsResponse({ IsTruncated: false, Contents: [] }));

    eventReplayer.replayEvents(bucketSettings, () => Promise.resolve());

    expect(AWS.S3).to.have.been.calledWith({
      region: 'ap-southeast-2',
      accessKeyId: 'ABC123',
      secretAccessKey: 'ABC123',
      endpoint: 'http://s3:1234',
    });
  });

  it('dispatches multiple events from multiple objects from multiple listObject calls', () => {
    s3.listObjectsV2.withArgs({ Bucket: 'archive-bucket', ContinuationToken: undefined }).returns(awsResponse({
      IsTruncated: true,
      NextContinuationToken: 'nextPlz',
      Contents: [{ Key: '2017-01-06_11' }, { Key: '2017-01-06_12' }],
    }));
    s3.listObjectsV2.withArgs({ Bucket: 'archive-bucket', ContinuationToken: 'nextPlz' }).returns(awsResponse({
      IsTruncated: false,
      Contents: [{ Key: '2017-01-06_13' }],
    }));
    const event1 = '{"sequenceNumber":"1","data":"base64Data1"}\n';
    const event2 = '{"sequenceNumber":"2","data":"base64Data2"}\n';
    const event3 = '{"sequenceNumber":"3","data":"base64Data3"}\n';
    const event4 = '{"sequenceNumber":"4","data":"base64Data4"}\n';
    const event5 = '{"sequenceNumber":"5","data":"base64Data5"}\n';
    const object1 = `${event1}${event2}`;
    const object2 = `${event3}`;
    const object3 = `${event4}${event5}`;
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: object1 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_12' }).returns(awsResponse({ Body: object2 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_13' }).returns(awsResponse({ Body: object3 }));

    const handleEvent = sandbox.stub().returns(Promise.resolve());
    return eventReplayer.replayEvents(bucketSettings, handleEvent).then(() => {
      expect(handleEvent).to.have.been.calledWith('1', 'base64Data1');
      expect(handleEvent).to.have.been.calledWith('2', 'base64Data2');
      expect(handleEvent).to.have.been.calledWith('3', 'base64Data3');
      expect(handleEvent).to.have.been.calledWith('4', 'base64Data4');
      expect(handleEvent).to.have.been.calledWith('5', 'base64Data5');
      expect(handleEvent.callCount).to.eql(5);
    });
  });

  it('handle events in sequence', () => {
    s3.listObjectsV2.withArgs({ Bucket: 'archive-bucket', ContinuationToken: undefined }).returns(awsResponse({
      IsTruncated: true,
      NextContinuationToken: 'nextPlz',
      Contents: [{ Key: '2017-01-06_11' }, { Key: '2017-01-06_12' }],
    }));
    s3.listObjectsV2.withArgs({ Bucket: 'archive-bucket', ContinuationToken: 'nextPlz' }).returns(awsResponse({
      IsTruncated: false,
      Contents: [{ Key: '2017-01-06_13' }],
    }));
    const event1 = '{"sequenceNumber":"1","data":"based64Data1"}\n';
    const event2 = '{"sequenceNumber":"2","data":"based64Data2"}\n';
    const event3 = '{"sequenceNumber":"3","data":"based64Data3"}\n';
    const event4 = '{"sequenceNumber":"4","data":"based64Data4"}\n';
    const event5 = '{"sequenceNumber":"5","data":"based64Data5"}\n';
    const object1 = `${event1}${event2}`;
    const object2 = `${event3}`;
    const object3 = `${event4}${event5}`;
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: object1 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_12' }).returns(awsResponse({ Body: object2 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_13' }).returns(awsResponse({ Body: object3 }));

    const spy = sandbox.spy();
    const eventHandler = (sequenceNumber) => (
      // This function acts as a slow event handler, which should be waited on by the replayer loop
      new Promise(resolve => {
        // This is just to track how many events have been processed
        spy();
        setTimeout(() => {
          // Then after waiting a bit, we make sure that no subsequent events have been handled in the meantime
          expect(spy.callCount).to.eql(parseInt(sequenceNumber));
          resolve();
        }, 0);
      })
    );
    return eventReplayer.replayEvents(bucketSettings, eventHandler);
  });

  it('retries events that fail temporarily', () => {
    s3.listObjectsV2.withArgs({ Bucket: 'archive-bucket', ContinuationToken: undefined }).returns(awsResponse({
      IsTruncated: false,
      Contents: [{ Key: '2017-01-06_11' }],
    }));
    const event = '{"sequenceNumber":"1","data":"base64Data"}\n';
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: event }));

    const handleEvent = sandbox.stub();
    handleEvent.onCall(0).rejects('Oops!');
    handleEvent.onCall(1).rejects('Oops!');
    handleEvent.onCall(2).resolves();
    return eventReplayer.replayEvents(bucketSettings, handleEvent, 0).then(() => {
      expect(handleEvent).to.have.been.calledWith('1', 'base64Data');
      expect(handleEvent.callCount).to.eql(3);
    });
  });
});
