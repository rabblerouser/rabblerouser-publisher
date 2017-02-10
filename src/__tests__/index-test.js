'use strict';
const createClient = require('..');

describe('createStream', () => {
  it('has a method to publish events to the stream', () => {
    expect(createClient({ stream: 'a-stream' }).publish).to.be.a('function');
  });

  it('has a listen function to receive events', () => {
    expect(createClient({ stream: 'a-stream' }).listen).to.be.a('function');
  });

  it('has a way to subscribe to particular event types', () => {
    expect(createClient({ stream: 'a-stream' }).on).to.be.a('function');
  });
});
