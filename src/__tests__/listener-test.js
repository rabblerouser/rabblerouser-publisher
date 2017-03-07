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

  const encodeEvent = event => new Buffer(JSON.stringify(event)).toString('base64')
  const requestBody = (sequenceNumber, event) => ({ sequenceNumber, data: encodeEvent(event) });

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
      const req = { header: () => undefined, body: requestBody("0", { type: 'some-event-type', data: {} }) };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(401);
      });
    });

    it('rejects the event if the auth header is wrong', () => {
      const req = { header: () => 'wrong', body: requestBody("0", { type: 'some-event-type', data: {} }) };
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
      const req = { header, body: { sequenceNumber: "0", data: "bad data" } };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(400);
      });
    });

    it('rejects the event if the request body has no sequenceNumber', () => {
      const req = { header, body: requestBody("", { type: 'some-event-type', data: { some: 'data' } }) };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(400);
      });
    });

    it('succeeds and does nothing if there is no handler that matches the given event', () => {
      const req = { header, body: requestBody("0", { type: 'ignore-me', data: {} }) };
      return listener.listen()(req, res).then(() => {
        expect(res.sendStatus).to.have.been.calledWith(204);
      });
    });

    it('succeeds and handles the event data when there is a matching handler', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      const req = { header, body: requestBody("0", { type: 'some-event-type', data: { some: 'data' } }) };
      return listener.listen()(req, res).then(() => {
        expect(eventHandler).to.have.been.calledWith({ some: 'data' });
        expect(res.sendStatus).to.have.been.calledWith(200);
      });
    });

    it('fails if the event handler fails', () => {
      const eventHandler = sinon.stub().returns(Promise.reject('Error!'));
      listener.on('some-event-type', eventHandler);

      const req = { header, body: requestBody("0", { type: 'some-event-type', data: { some: 'data' } }) }
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
      const req = { header, body: requestBody("0", { type: 'ignore-me', data: {} }) };
      return listener.listen()(req, res).then(() => {
        expect(res.status).to.have.been.calledWith(503);
      });
    });

    it('will never accept events if the replaying fails', () => {
      eventReplayer.replayEvents.returns(Promise.reject());
      const req = { header, body: requestBody("0", { type: 'ignore-me', data: {} }) };

      const middleware = listener.listen();
      return Promise.resolve().then(() => (
        middleware(req, res)
      )).then(() => {
        expect(res.status).to.have.been.calledWith(503);
      });
    });

    it('accepts stream events after the replaying finishes', () => {
      eventReplayer.replayEvents.returns(Promise.resolve());
      const req = { header, body: requestBody("0", { type: 'ignore-me', data: {} }) };

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
      return bucketEventHandler("0", encodeEvent({ type: 'some-event-type', data: { some: 'data' } }))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'data' });
        });
    });

    it('rejects invalid archive events', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      return bucketEventHandler("0", { type: 'some-event-type', data: { some: 'data' } })
        .then(
          () => { throw new Error('Should not have got here.'); },
          err => { expect(err).to.match(/Failed to parse/); }
        );
    });

    it('allows a bucket event to be replayed if it failed the first time', () => {
      const eventHandler = sinon.stub()
      eventHandler.onCall(0).returns(Promise.reject());
      eventHandler.onCall(1).returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      const event = encodeEvent({ type: 'some-event-type', data: { some: 'data' } });
      return Promise.resolve()
        .then(() => bucketEventHandler("0", event).catch(() => {}))
        .then(() => bucketEventHandler("0", event))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'data' });
          expect(eventHandler.callCount).to.eql(2);
        });
    });

    it('does not double-handle events when for some reason the same event is in the archive twice', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      const event = encodeEvent({ type: 'some-event-type', data: { some: 'data' } });
      return Promise.resolve()
        .then(() => bucketEventHandler("0", event))
        .then(() => bucketEventHandler("0", event))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'data' });
          expect(eventHandler.callCount).to.eql(1);
        });
    });

    it("is not fooled by sequenceNumber strings of different lengths", () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      const goodEvent = encodeEvent({ type: 'some-event-type', data: { some: 'handled data' } });
      const outOfOrderEvent = encodeEvent({ type: 'some-event-type', data: { some: 'ignored data' } });
      return Promise.resolve()
        // Alphabetical comparison of these sequenceNumber strings will result in ("10" < "9" === true)
        .then(() => bucketEventHandler("10", goodEvent))
        .then(() => bucketEventHandler("9", outOfOrderEvent))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'handled data' });
          expect(eventHandler).not.to.have.been.calledWith({ some: 'ignored data' });
          expect(eventHandler.callCount).to.eql(1);
        });
    });

    it("is not fooled by numbers larger than Number.MAX_SAFE_INTEGER", () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      listener.listen();

      const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
      const firstEvent = encodeEvent({ type: 'some-event-type', data: { some: 'first data' } });
      const secondEvent = encodeEvent({ type: 'some-event-type', data: { some: 'second data' } });
      return Promise.resolve()
        // parseInt will truncate these two numbers to the same value, which would cause the second one to be ignored
        .then(() => bucketEventHandler("49571033776140984913098869278824287563719901118904401922", firstEvent))
        .then(() => bucketEventHandler("49571033776140984913098869278824287563719901118904401923", secondEvent))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'first data' });
          expect(eventHandler).to.have.been.calledWith({ some: 'second data' });
          expect(eventHandler.callCount).to.eql(2);
        });
    });

    it('does not double-handle events when for some reason the same event comes from the stream twice', () => {
      const eventHandler = sinon.stub().returns(Promise.resolve());
      listener.on('some-event-type', eventHandler);

      eventReplayer.replayEvents.returns(Promise.resolve());
      const middleware = listener.listen();

      const req = { header, body: requestBody("0", { type: 'some-event-type', data: { some: 'data' } }) };
      return Promise.resolve()
        .then(() => middleware(req, res))
        .then(() => middleware(req, res))
        .then(() => {
          expect(eventHandler).to.have.been.calledWith({ some: 'data' });
          expect(eventHandler.callCount).to.eql(1);
        });
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
        bucketEventHandler(sequenceNumber.toString(), encodeEvent(events[sequenceNumber]))
      ))).then(() => (

        // Now send events 1, 2, and 3 from the stream
        Promise.all([1, 2, 3].map(sequenceNumber => {
          const req = { header, body: requestBody(sequenceNumber.toString(), events[sequenceNumber]) };
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
