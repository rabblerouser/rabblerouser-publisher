const chai = require('chai');
const expect = chai.expect;
const publisher = require('../');

describe('rabblerouser-publisher', () => {
  describe('on initialisation', () => {

    it('should require a stream name', () => {
      expect(() => { publisher({}) }).to.throw(Error, /No stream defined./);
    });

    it('should return a function to publish events to the given stream', () => {
      expect(publisher( { stream: 'a-stream' })).to.be.a('function');
    });
  });
});
