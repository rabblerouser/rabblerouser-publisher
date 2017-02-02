const createConsumer = require('../consumer');

describe('consumer', () => {
  let sandbox;
  let res;
  const header = () => 'secret';

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    res = {
      status: sinon.stub().returns({ json: () => {} }),
      sendStatus: sinon.spy(),
    };
    process.env.EVENT_AUTH_TOKEN = 'secret';
  });

  afterEach(() => {
    sandbox.restore();
    process.env.EVENT_AUTH_TOKEN = 'secret';
  })

  it('refuses to register an event handler to no event type', () => {
    expect(() => { createConsumer().on('', () => {}) }).to.throw(Error, /No event type defined for handler./);
    expect(() => { createConsumer().on(null, () => {}) }).to.throw(Error, /No event type defined for handler./);
  });

  it('refuses to register event handlers that are not functions', () => {
    expect(() => { createConsumer().on('event-type') }).to.throw(Error, /Invalid event handler./);
    expect(() => { createConsumer().on('event-type', 5) }).to.throw(Error, /Invalid event handler./);
  });

  it('blows up if the request has no body', () => {
    createConsumer()({ header }, res);

    expect(res.status).to.have.been.calledWith(500);
  });

  it('succeeds if there is no handler that matches the given event', () => {
    createConsumer()({ header, body: {} }, res);

    expect(res.sendStatus).to.have.been.calledWith(200);
  });

  it('succeeds and sends the event data when there is a registered handler', () => {
    const consumer = createConsumer();

    const eventHandler = sinon.spy();
    consumer.on('some-event-type', eventHandler);

    consumer({ header, body: { type: 'some-event-type', data: { some: 'data' } } }, res);

    expect(eventHandler).to.have.been.calledWith({ some: 'data' });
  });

  it('does not allow the event if the auth header is missing', () => {
    const consumer = createConsumer();
    consumer({ header: () => undefined, body: { type: 'some-event-type', data: { some: 'data' } } }, res);

    expect(res.status).to.have.been.calledWith(401);
  });

  it('does not allow the event if the auth header is wrong', () => {
    process.env.EVENT_AUTH_TOKEN = '53cr3t';

    const consumer = createConsumer();
    consumer({ header, body: { type: 'some-event-type', data: { some: 'data' } } }, res);

    expect(res.status).to.have.been.calledWith(401);
  });
});
