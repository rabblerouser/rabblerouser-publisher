'use strict';
const createListener = require('../listener');
const eventReplayer = require('../event-replayer');

describe('listener', () => {
  let sandbox;
  let res;
  let listener;
  const header = () => 'secret';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    res = {
      status: sinon.stub().returns({ json: sinon.spy() }),
      sendStatus: sinon.spy(),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  const requestBody = (sequenceNumber, event) => ({
    sequenceNumber,
    data: new Buffer(JSON.stringify(event)).toString('base64'),
  });

  describe('creation', () => {
      it('allows no auth token to be configured, but blows up if you then try to use the listener', () => {
        const nullListener = createListener({});
        expect(() => nullListener.on()).to.throw(/Cannot register an event handler/);
        expect(() => nullListener.listen()).to.throw(/Cannot listen for events/);
      });

      it('blows up straight away if you specify an archive bucket but no region', () => {
        const code = () => createListener({ listenWithAuthToken: 'secret', readArchiveFromBucket: 'archive-bucket' });
        expect(code).to.throw(/no region/);
      });

      it('blows up straight away if you specify an archive bucket but no accessKeyId', () => {
        const settings = { listenWithAuthToken: 'secret', readArchiveFromBucket: 'archive-bucket', region: 'ap-southeast-2' };
        const code = () => createListener(settings);
        expect(code).to.throw(/no accessKeyId/);
      });

      it('blows up straight away if you specify an archive bucket but no secretAccessKey', () => {
        const settings = { listenWithAuthToken: 'secret', readArchiveFromBucket: 'archive-bucket', region: 'ap-southeast-2', accessKeyId: 'ABC123' };
        const code = () => createListener(settings);
        expect(code).to.throw(/no secretAccessKey/);
      });
  });

  describe('without a bucket', () => {
    beforeEach(() => {
      listener = createListener({ listenWithAuthToken: 'secret' });
    });

    it('refuses to register an event handler to no event type', () => {
      expect(() => { listener.on('', () => {}) }).to.throw(Error, /No event type defined for handler/);
      expect(() => { listener.on(null, () => {}) }).to.throw(Error, /No event type defined for handler/);
    });

    it('refuses to register event handlers that are not functions', () => {
      expect(() => { listener.on('event-type') }).to.throw(Error, /Invalid event handler/);
      expect(() => { listener.on('event-type', 5) }).to.throw(Error, /Invalid event handler/);
    });

    it('rejects the event if the auth header is missing', () => {
      const req = { header: () => undefined, body: { type: 'some-event-type', data: { some: 'data' } } };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(401);
      });
    });

    it('rejects the event if the auth header is wrong', () => {
      const req = { header: () => 'wrong', body: { type: 'some-event-type', data: { some: 'data' } } };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(401);
      });
    });

    it('rejects the event if the request has no body', () => {
      const req = { header };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(400);
      });
    });

    it('rejects the event if the request body has no data', () => {
      const req = { header, body: {} };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(400);
      });
    });

    it('rejects the event if the request body data is not a base64-encoded JSON string', () => {
      const req = { header, body: { data: "bad data" } };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(400);
      });
    });it('succeeds if there is no handler that matches the given event', () => {
      const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };
      return listener.listen()(req, res).then(() => {
        expect(res.sendStatus).to.have.been.calledWith(204);
      });
    });

    it('succeeds and sends the event data when there is a matching handler', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      const req = { header, body: requestBody(0, { type: 'some-event-type', data: { some: 'data' } }) };
      return listener.listen()(req, res).then(() => {
        expect(eventHandler).to.have.been.calledWith({ some: 'data' });
        expect(res.sendStatus).to.have.been.calledWith(200);
      });
    });

    it('fails if the event handler fails', () => {
      const eventHandler = sinon.stub().returns(Promise.reject('Error!'));
      listener.on('some-event-type', eventHandler);

      const req = { header, body: requestBody(0, { type: 'some-event-type', data: { some: 'data' } }) }
      return listener.listen()(req, res).then(() => {
        expect(eventHandler).to.have.been.calledWith({ some: 'data' });
        expect(res.status).to.have.been.calledWith(500);
        expect(res.status().json).to.have.been.calledWith({ error: 'Error!' });
      });
    });
  });

  describe('with a bucket', () => {
    beforeEach(() => {
      sandbox.stub(eventReplayer, 'replayEvents');
      listener = createListener({
        listenWithAuthToken: 'secret',
        readArchiveFromBucket: 'archive-bucket',
        region: 'ap-southeast-2',
        accessKeyId: 'ABC123',
        secretAccessKey: 'ABC123',
        s3Endpoint: 'http://s3:1234',
        garbage: 'superfluous',
      });
    });

    it('passes the relevant config to the event replayer', () => {
      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();
      expect(eventReplayer.replayEvents.args[0][0]).to.eql({
        bucket: 'archive-bucket',
        region: 'ap-southeast-2',
        accessKeyId: 'ABC123',
        secretAccessKey: 'ABC123',
        endpoint: 'http://s3:1234',
      });
    });

    it('rejects the event if currently replaying history from the bucket', () => {
      eventReplayer.replayEvents.returns(new Promise(() => {}));
      const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(503);
      });
    });

    it('will never accept events if the replaying fails', () => {
      eventReplayer.replayEvents.returns(Promise.reject());
      const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };

      const middleware = listener.listen();
      return Promise.resolve().then(() => (
        middleware(req, res)
      )).then(() => {
        expect(res.status).to.have.been.calledWith(503);
      });
    });

    it('accepts stream events after the replaying finishes', () => {
      eventReplayer.replayEvents.returns(Promise.resolve());
      const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };

      const middleware = listener.listen();
      return Promise.resolve().then(() => (
        middleware(req, res)
      )).then(() => {
        expect(res.sendStatus).to.have.been.calledWith(204);
      });
    });

    it('handles events coming out from the event replayer', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } });
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
    });

    it('allows a bucket event to be replayed twice if it failed the first time', () => {
      const eventHandler = sinon.stub()
      eventHandler.onCall(0).returns(Promise.reject());
      eventHandler.onCall(1).returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } }).catch(() => {});
      bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } });
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
      expect(eventHandler.callCount).to.eql(2);
    });

    it('does not double-handle events when the archive and the stream have some overlap', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      const middleware = listener.listen();

      const events = [0, 1, 2, 3].map(i => (
        { type: 'some-event-type', data: { some: `data${i}` } }
      ));

      // Send events 0, 1, and 2 from the bucket first
      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      return Promise.all([0, 1, 2].map(sequenceNumber => (
        bucketEventHandler(sequenceNumber, events[sequenceNumber])
      ))).then(() => (

        // Now send events 1, 2, and 3 from the stream
        Promise.all([1, 2, 3].map(sequenceNumber => {
          const req = { header, body: requestBody(sequenceNumber, events[sequenceNumber]) };
          return middleware(req, res);
        }))
      )).then(() => {
        // It should have processed all the events...
        expect(eventHandler).to.have.been.calledWith({ some: 'data0' });
        expect(eventHandler).to.have.been.calledWith({ some: 'data1' });
        expect(eventHandler).to.have.been.calledWith({ some: 'data2' });
        expect(eventHandler).to.have.been.calledWith({ some: 'data3' });

        // ... and events 1 and 2 should have come through only once each
        expect(eventHandler.callCount).to.eql(4);
      });
    });
  });
});
