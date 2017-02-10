const AWS = require('aws-sdk');
const eventReplayer = require('../event-replayer');

describe('eventReplayer', () => {
  let sandbox;
  let s3;

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
    const event1 = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Kirk\\"}}","sequenceNumber":"1"}\n`;
    const event2 = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Picard\\"}}","sequenceNumber":"2"}\n`;
    const event3 = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Sisko\\"}}","sequenceNumber":"3"}\n`;
    const event4 = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Janeway\\"}}","sequenceNumber":"4"}\n`;
    const event5 = `{"data":"{\\"type\\":\\"reg\\",\\"data\\":{\\"name\\":\\"Archer\\"}}","sequenceNumber":"5"}\n`;
    const object1 = `${event1}${event2}`;
    const object2 = `${event3}`;
    const object3 = `${event4}${event5}`;
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_11' }).returns(awsResponse({ Body: object1 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_12' }).returns(awsResponse({ Body: object2 }));
    s3.getObject.withArgs({ Bucket: 'archive-bucket', Key: '2017-01-06_13' }).returns(awsResponse({ Body: object3 }));

    const handleEvent = sandbox.spy();
    return eventReplayer.replayEvents('archive-bucket', handleEvent).then(() => {
      expect(handleEvent).to.have.been.calledWith({ type: 'reg', data: { name: 'Kirk' } });
      expect(handleEvent).to.have.been.calledWith({ type: 'reg', data: { name: 'Picard' } });
      expect(handleEvent).to.have.been.calledWith({ type: 'reg', data: { name: 'Sisko' } });
      expect(handleEvent).to.have.been.calledWith({ type: 'reg', data: { name: 'Janeway' } });
      expect(handleEvent).to.have.been.calledWith({ type: 'reg', data: { name: 'Archer' } });
      expect(handleEvent.callCount).to.eql(5);
    });
  });
});
