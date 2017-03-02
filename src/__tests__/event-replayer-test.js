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
    const event1 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{\\"name\\":\\"Kirk\\"}}","sequenceNumber":1}\n`;
    const event2 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{\\"name\\":\\"Picard\\"}}","sequenceNumber":2}\n`;
    const event3 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{\\"name\\":\\"Sisko\\"}}","sequenceNumber":3}\n`;
    const event4 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{\\"name\\":\\"Janeway\\"}}","sequenceNumber":4}\n`;
    const event5 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{\\"name\\":\\"Archer\\"}}","sequenceNumber":5}\n`;
    const object1 = `${event1}${event2}`;
    const object2 = `${event3}`;
    const object3 = `${event4}${event5}`;
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: object1 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_12' }).returns(awsResponse({ Body: object2 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_13' }).returns(awsResponse({ Body: object3 }));

    const handleEvent = sandbox.stub().returns(Promise.resolve());
    return eventReplayer.replayEvents(bucketSettings, handleEvent).then(() => {
      expect(handleEvent).to.have.been.calledWith(1, { type: 'register', data: { name: 'Kirk' } });
      expect(handleEvent).to.have.been.calledWith(2, { type: 'register', data: { name: 'Picard' } });
      expect(handleEvent).to.have.been.calledWith(3, { type: 'register', data: { name: 'Sisko' } });
      expect(handleEvent).to.have.been.calledWith(4, { type: 'register', data: { name: 'Janeway' } });
      expect(handleEvent).to.have.been.calledWith(5, { type: 'register', data: { name: 'Archer' } });
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
    const event1 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{}}","sequenceNumber":1}\n`;
    const event2 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{}}","sequenceNumber":2}\n`;
    const event3 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{}}","sequenceNumber":3}\n`;
    const event4 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{}}","sequenceNumber":4}\n`;
    const event5 = `{"data":"{\\"type\\":\\"register\\",\\"data\\":{}}","sequenceNumber":5}\n`;
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
          expect(spy.callCount).to.eql(sequenceNumber);
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
    const event = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Kirk\\"}}","sequenceNumber":1}\n`;
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: event }));

    const handleEvent = sandbox.stub();
    handleEvent.onCall(0).returns(Promise.reject());
    handleEvent.onCall(1).returns(Promise.reject());
    handleEvent.onCall(2).returns(Promise.resolve());
    return eventReplayer.replayEvents(bucketSettings, handleEvent).then(() => {
      expect(handleEvent).to.have.been.calledWith(1, { type: 'reg', data: { name: 'Kirk' } });
      expect(handleEvent.callCount).to.eql(3);
    });
  });
});
