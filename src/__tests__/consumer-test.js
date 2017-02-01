const createConsumer = require('../consumer');

describe('consumer', () => {
  let sandbox;
  let res;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    res = {
      status: sinon.stub().returns({ json: () => {} }),
      sendStatus: sinon.spy(),
    }
  });

  afterEach(() => {
    sandbox.restore();
  })

  it('blows up if the request has no body', () => {
    createConsumer()({}, res);

    expect(res.status).to.have.been.calledWith(500);
  });

  it('succeeds if there is no handler that matches the given event', () => {
    createConsumer()({ body: {} }, res);

    expect(res.sendStatus).to.have.been.calledWith(200);
  });

  it('refuses to register an event handler to no event type', () => {
    expect(() => { createConsumer().on('', () => {}) }).to.throw(Error, /No event type defined for handler./);
    expect(() => { createConsumer().on(null, () => {}) }).to.throw(Error, /No event type defined for handler./);
  });

  it('refuses to register event handlers that are not functions', () => {
    expect(() => { createConsumer().on('event-type') }).to.throw(Error, /Invalid event handler./);
    expect(() => { createConsumer().on('event-type', 5) }).to.throw(Error, /Invalid event handler./);
  });

  it('succeeds and sends the event data when there is a registered handler', () => {
    const consumer = createConsumer();

    const eventHandler = sinon.spy();
    consumer.on('some-event-type', eventHandler);

    consumer({ body: { type: 'some-event-type', data: { some: 'data' } } }, res);

    expect(eventHandler).to.have.been.calledWith({ some: 'data' });
  });
});
