const AWS = require('aws-sdk');

const createPublisher = require('../publisher');

describe('publisher', () => {
  let sandbox;
  let putRecord;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    putRecord = sandbox.stub().returns({ promise: () => {} });
    sandbox.stub(AWS, 'Kinesis').returns({ putRecord });
  });

  afterEach(() => {
    sandbox.restore();
  })

  it('should require settings to be given', () => {
    expect(() => { createPublisher() }).to.throw(Error, /No settings defined./);
  });

  it('should require a stream name', () => {
    expect(() => { createPublisher({}) }).to.throw(Error, /No stream defined./);
  });

  it('returns a function that can put records to kinesis', () => {
    const publish = createPublisher({ stream: 'my-stream' });
    publish({ type: 'some-type', data: { some: 'data' } });

    expect(putRecord).to.have.been.calledWith({
      Data: '{"type":"some-type","data":{"some":"data"}}',
      PartitionKey: 'some-type',
      StreamName: 'my-stream',
    });
  });

  it('only sends the type and data to kinesis', () => {
    const publish = createPublisher({ stream: 'my-stream' });
    publish({ type: 'some-type', data: { some: 'data' }, extra: 'info' });

    expect(putRecord).to.have.been.calledWith({
      Data: '{"type":"some-type","data":{"some":"data"}}',
      PartitionKey: 'some-type',
      StreamName: 'my-stream',
    });
  });

  it('refuses to send events without a type', () => {
    const publish = createPublisher({ stream: 'my-stream' });

    expect(() => { publish({ data: {} }) }).to.throw(Error, /Invalid event type/);
  });

  it('refuses to send events where type is not a string', () => {
    const publish = createPublisher({ stream: 'my-stream' });

    expect(() => { publish({ type: 5, data: {} }) }).to.throw(Error, /Invalid event type/);
  });

  it('refuses to send events where type is blank', () => {
    const publish = createPublisher({ stream: 'my-stream' });

    expect(() => { publish({ type: '', data: {} }) }).to.throw(Error, /Invalid event type/);
  });

  it('refuses to send events without data', () => {
    const publish = createPublisher({ stream: 'my-stream' });

    expect(() => { publish({ type: 'some-type' }) }).to.throw(Error, /No event data defined./);
  });
});
