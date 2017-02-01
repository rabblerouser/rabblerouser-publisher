const chai = require('chai');
const expect = chai.expect;

const publisher = require('../src/publisher');

describe('publisher', () => {
  it('should require settings to be given', () => {
    expect(() => { publisher() }).to.throw(Error, /No settings defined./);
  });

  it('should require a stream name', () => {
    expect(() => { publisher({}) }).to.throw(Error, /No stream defined./);
  });
});
