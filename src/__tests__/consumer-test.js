'use strict';
const createConsumer = require('../consumer');
const eventReplayer = require('../event-replayer');

describe('consumer', () => {
  let sandbox;
  let res;
  let consumer;
  const header = () => 'secret';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    sandbox.stub(eventReplayer, 'replayEvents');
    res = {
      status: sinon.stub().returns({ json: sinon.spy() }),
      sendStatus: sinon.spy(),
    };
    consumer = createConsumer({ eventAuthToken: 'secret' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  const requestBody = (sequenceNumber, event) => ({
    sequenceNumber,
    data: new Buffer(JSON.stringify(event)).toString('base64'),
  });

  it('refuses to register an event handler to no event type', () => {
    expect(() => { consumer.on('', () => {}) }).to.throw(Error, /No event type defined for handler./);
    expect(() => { consumer.on(null, () => {}) }).to.throw(Error, /No event type defined for handler./);
  });

  it('refuses to register event handlers that are not functions', () => {
    expect(() => { consumer.on('event-type') }).to.throw(Error, /Invalid event handler./);
    expect(() => { consumer.on('event-type', 5) }).to.throw(Error, /Invalid event handler./);
  });

  it('rejects the event if the auth header is missing', () => {
    const req = { header: () => undefined, body: { type: 'some-event-type', data: { some: 'data' } } };
    return consumer.listen({})(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(401);
    });
  });

  it('rejects the event if the auth header is wrong', () => {
    const req = { header: () => 'wrong', body: { type: 'some-event-type', data: { some: 'data' } } };
    return consumer.listen({})(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(401);
    });
  });

  it('rejects the event if the request has no body', () => {
    const req = { header };
    return consumer.listen({})(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(400);
    });
  });

  it('rejects the event if the request body has no data', () => {
    const req = { header, body: {} };
    return consumer.listen({})(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(400);
    });
  });

  it('rejects the event if the request body data is not a base64-encoded JSON string', () => {
    const req = { header, body: { data: "bad data" } };
    return consumer.listen({})(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(400);
    });
  });

  it('rejects the event if currently replaying history from elsewhere', () => {
    eventReplayer.replayEvents.returns(Promise.resolve());
    const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };
    return consumer.listen({ archiveBucket: 'myBucket' })(req, res).then(() => {
      expect(res.status).to.have.been.calledWith(503);
    });
  });

  it('accepts events after the replaying finishes', () => {
    eventReplayer.replayEvents.returns(Promise.resolve());
    const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };

    const middleware = consumer.listen({ archiveBucket: 'myBucket' });
    return Promise.resolve().then(() => (
      middleware(req, res)
    )).then(() => {
      expect(res.sendStatus).to.have.been.calledWith(204);
    });
  });

  it('will never accept events if the replaying fails', () => {
    eventReplayer.replayEvents.returns(Promise.reject());
    const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };

    const middleware = consumer.listen({ archiveBucket: 'myBucket' });
    return Promise.resolve().then(() => (
      middleware(req, res)
    )).then(() => {
      expect(res.status).to.have.been.calledWith(503);
    });
  });

  it('succeeds if there is no handler that matches the given event', () => {
    const req = { header, body: requestBody(0, { type: 'ignore-me', data: {} }) };
    return consumer.listen({})(req, res).then(() => {
      expect(res.sendStatus).to.have.been.calledWith(204);
    });
  });

  it('succeeds and sends the event data when there is a registered handler', () => {
    const eventHandler = sinon.stub().returns(Promise.resolve());
    consumer.on('some-event-type', eventHandler);

    const req = { header, body: requestBody(0, { type: 'some-event-type', data: { some: 'data' } }) };
    return consumer.listen({})(req, res).then(() => {
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
      expect(res.sendStatus).to.have.been.calledWith(200);
    });
  });

  it('fails if the event handler fails', () => {
    const eventHandler = sinon.stub().returns(Promise.reject('Error!'));
    consumer.on('some-event-type', eventHandler);

    const req = { header, body: requestBody(0, { type: 'some-event-type', data: { some: 'data' } }) }
    return consumer.listen({})(req, res).then(() => {
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
      expect(res.status).to.have.been.calledWith(500);
      expect(res.status().json).to.have.been.calledWith({ error: 'Error!' });
    });
  });

  it('handles events coming out from the event replayer', () => {
    const eventHandler = sinon.stub().returns(Promise.resolve());
    consumer.on('some-event-type', eventHandler);

    eventReplayer.replayEvents.returns(Promise.resolve());
    consumer.listen({ archiveBucket: 'myBucket' });

    const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
    bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } });
    expect(eventHandler).to.have.been.calledWith({ some: 'data' });
  });

  it('allows a bucket event to be replayed twice if it failed the first time', () => {
    const eventHandler = sinon.stub()
    eventHandler.onCall(0).returns(Promise.reject());
    eventHandler.onCall(1).returns(Promise.resolve());
    consumer.on('some-event-type', eventHandler);

    eventReplayer.replayEvents.returns(Promise.resolve());
    consumer.listen({ archiveBucket: 'myBucket' });

    const bucketEventHandler = eventReplayer.replayEvents.args[0][1];
    bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } }).catch(() => {});
    bucketEventHandler(0, { type: 'some-event-type', data: { some: 'data' } });
    expect(eventHandler).to.have.been.calledWith({ some: 'data' });
    expect(eventHandler.callCount).to.eql(2);
  });

  it('does not double-handle events when the archive and the stream have some overlap', () => {
    const eventHandler = sinon.stub().returns(Promise.resolve());
    consumer.on('some-event-type', eventHandler);

    eventReplayer.replayEvents.returns(Promise.resolve());
    const middleware = consumer.listen({ archiveBucket: 'myBucket' });

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
      expect(eventHandler).to.have.been.calledWith({ some: 'data0' });
      expect(eventHandler).to.have.been.calledWith({ some: 'data1' });
      expect(eventHandler).to.have.been.calledWith({ some: 'data2' });
      expect(eventHandler).to.have.been.calledWith({ some: 'data3' });
      // Events 1 and 1 should have come through only once each
      expect(eventHandler.callCount).to.eql(4);
    });
  });
});
