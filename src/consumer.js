'use strict';

const validateEventHandler = (eventType, handler) => {
  if (!eventType) {
    throw new Error('No event type defined for handler.');
  }

  if (!handler || typeof handler !== 'function') {
    throw new Error('Invalid event handler.');
  }
}

const createConsumer = (settings) => {
  const eventHandlers = {};

  const consumer = (req, res) => {
    if (!req.header('Authorization') || req.header('Authorization') !== settings.eventAuthToken) {
      return res.status(401).json({ error: 'Invalid Authorization header' });
    }

    const event = req.body;
    if (!event) {
      return res.status(500).json({ error: 'something went wrong!' });
    }

    const eventHandler = eventHandlers[event.type];
    if (eventHandler) {
      process.env.NODE_ENV !== 'test' && console.log('Handling event:', event);
      eventHandler(event.data);
    }

    res.sendStatus(200);
  };

  consumer.on = (eventType, handler) => {
    validateEventHandler(eventType, handler);

    eventHandlers[eventType] = handler;
  };

  return consumer;
};


module.exports = createConsumer;
