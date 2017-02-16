'use strict';
const createClient = require('..');

describe('createStream', () => {
  it('requires settings as an object', () => {
    expect(() => { createClient() }).to.throw(Error, /No settings defined/);
    expect(() => { createClient('hey') }).to.throw(Error, /Settings must be an object/);
  });

  it('returns an object with all the right methods', () => {
    const streamClient = createClient({});

    expect(streamClient.publish).to.be.a('function');
    expect(streamClient.on).to.be.a('function');
    expect(streamClient.listen).to.be.a('function');
  })
});
