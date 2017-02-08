const createConsumer = require('../consumer');

describe('consumer', () => {
  let sandbox;
  let res;
  let consumer;
  const header = () => 'secret';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    res = {
      status: sinon.stub().returns({ json: sinon.spy() }),
      sendStatus: sinon.spy(),
    };
    consumer = createConsumer({ eventAuthToken: 'secret' });
  });

  afterEach(() => {
    sandbox.restore();
  });

  const requestBody = event => ({ data: new Buffer(JSON.stringify(event)).toString('base64') });

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

  it('succeeds if there is no handler that matches the given event', () => {
    const req = { header, body: requestBody({ type: 'ignore-me', data: {} }) };
    return consumer.listen({})(req, res).then(() => {
      expect(res.sendStatus).to.have.been.calledWith(204);
    });
  });

  it('succeeds and sends the event data when there is a registered handler', () => {
    const eventHandler = sinon.stub().returns(Promise.resolve());
    consumer.on('some-event-type', eventHandler);

    const req = { header, body: requestBody({ type: 'some-event-type', data: { some: 'data' } }) };
    return consumer.listen({})(req, res).then(() => {
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
      expect(res.sendStatus).to.have.been.calledWith(200);
    });
  });

  it('fails if the event handler fails', () => {
    const eventHandler = sinon.stub().returns(Promise.reject('Error!'));
    consumer.on('some-event-type', eventHandler);

    const event = { type: 'some-event-type', data: { some: 'data' } };
    return consumer.listen({})({ header, body: requestBody(event) }, res).then(() => {
      expect(eventHandler).to.have.been.calledWith({ some: 'data' });
      expect(res.status).to.have.been.calledWith(500);
      expect(res.status().json).to.have.been.calledWith({ error: 'Error!' });
    });
  });
});
