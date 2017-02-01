'use strict';

const eventHandlers = {};

// TODO: Authenticate the request
const consumer = (req, res) => {
  const event = req.body;
  if (!event) {
    res.status(500).json({ error: 'something went wrong!' });
  }

  const eventHandler = eventHandlers[event.type];
  if (eventHandler) {
    console.log('Handling event:', event);
    eventHandler(event.data);
  }

  res.sendStatus(200);
}

consumer.on = (eventType, handler) => {
  eventHandlers[eventType] = handler;
}

module.exports = consumer;
