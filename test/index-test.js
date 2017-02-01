const createClient = require('../src');

describe('createStream', () => {
  it('has a method to publish events to the stream', () => {
    expect(createClient({ stream: 'a-stream' }).publish).to.be.a('function');
  });

  it('has a consumer function to receive events', () => {
    expect(createClient({ stream: 'a-stream' }).consumer).to.be.a('function');
  });

  it('has a way to subscribe to particular event types', () => {
    expect(createClient({ stream: 'a-stream' }).consumer.on).to.be.a('function');
  });
});
