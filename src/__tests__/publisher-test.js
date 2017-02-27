'use strict';
const AWS = require('aws-sdk');

const createPublisher = require('../publisher');

describe('publisher', () => {
  let sandbox;
  let putRecord;
  const validSettings = {
    publishToStream: 'my-stream',
    region: 'ap-southeast-2',
    accessKeyId: 'ABC123',
    secretAccessKey: 'ABC123',
    kinesisEndpoint: 'http://kinesis:1234',
    otherGarbage: 'superfluous',
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    putRecord = sandbox.stub().returns({ promise: () => {} });
    sandbox.stub(AWS, 'Kinesis').returns({ putRecord });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('allows no stream to be configured, but will blow up if you then try to publish an event', () => {
    const code = () => createPublisher({})();
    expect(code).to.throw(/Cannot publish an event/);
  });

  it('blows up straight away if you specify a stream but no region', () => {
    const code = () => createPublisher({ publishToStream: 'my-stream' });
    expect(code).to.throw(Error, /no region/);
  });

  it('blows up straight away if you specify a stream but no access key', () => {
    const code = () => createPublisher({ publishToStream: 'my-stream', region: 'ap-southeast-2' });
    expect(code).to.throw(Error, /no accessKeyId/);
  });

  it('blows up straight away if you specify a stream but no secret key', () => {
    const code = () => createPublisher({ publishToStream: 'my-stream', region: 'ap-southeast-2', accessKeyId: 'ABC123' });
    expect(code).to.throw(Error, /no secretAccessKey/);
  });

  it('only passes the relevant config to the AWS SDK', () => {
    const publish = createPublisher(validSettings);

    expect(AWS.Kinesis).to.have.been.calledWith({
      apiVersion: '2013-12-02',
      region: 'ap-southeast-2',
      accessKeyId: 'ABC123',
      secretAccessKey: 'ABC123',
      endpoint: 'http://kinesis:1234',
    });
  });

  it('can put records to kinesis', () => {
    const publish = createPublisher(validSettings);
    publish('some-type', { some: 'data' });

    expect(putRecord).to.have.been.calledWith({
      Data: '{"type":"some-type","data":{"some":"data"}}',
      PartitionKey: 'some-type',
      StreamName: 'my-stream',
    });
  });

  it('refuses to send events without a type', () => {
    const publish = createPublisher(validSettings);

    expect(() => { publish(null, {}) }).to.throw(Error, /Invalid eventType/);
  });

  it('refuses to send events where type is not a string', () => {
    const publish = createPublisher(validSettings);

    expect(() => { publish(5, {}) }).to.throw(Error, /Invalid eventType/);
  });

  it('refuses to send events where type is blank', () => {
    const publish = createPublisher(validSettings);

    expect(() => { publish('', {}) }).to.throw(Error, /Invalid eventType/);
  });

  it('refuses to send events without data', () => {
    const publish = createPublisher(validSettings);

    expect(() => { publish('some-type') }).to.throw(Error, /Missing eventData/);
  });
});
