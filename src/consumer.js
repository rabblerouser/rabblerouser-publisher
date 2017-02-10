'use strict';
const eventReplayer = require('./event-replayer');

const validateEventHandler = (eventType, handler) => {
  if (!eventType) {
    throw new Error('No event type defined for handler.');
  }

  if (!handler || typeof handler !== 'function') {
    throw new Error('Invalid event handler.');
  }
};

const parseRequestBody = body => {
  if (!body) return null;
  if (!body.data) return null;
  try {
    return JSON.parse(new Buffer(body.data, 'base64'));
  } catch(e) {
    return null;
  }
};

const rejectNewEventsWhileReplaying = replaying => req => {
  if (replaying) {
    throw { status: 503, error: 'Currently replaying historical events. Try again soon.' }
  }
  return req;
}

const checkAuth = eventAuthToken => req  => {
  if (!req.header('Authorization') || req.header('Authorization') !== eventAuthToken) {
    throw { status: 401, error: 'Invalid Authorization header' };
  }
  return req;
};

const parseEvent = req => {
  const event = parseRequestBody(req.body);
  if (!event) {
    throw { status: 400, error: 'Missing or invalid request body' };
  }
  return event;
};

const handleEvent = eventHandlers => event => {
  const eventHandler = eventHandlers[event.type];
  if (!eventHandler) {
    process.env.NODE_ENV !== 'test' && console.log('Ignoring event:', event);
    return 204;
  }
  process.env.NODE_ENV !== 'test' && console.log('Handling event:', event);
  return eventHandler(event.data).then(
    () => 200,
    error => { throw { status: 500, error }; }
  );
};

const createConsumer = ({ eventAuthToken }) => {
  const eventHandlers = {};
  let replaying = false;

  const on = (eventType, handler) => {
    validateEventHandler(eventType, handler);
    eventHandlers[eventType] = handler;
  };

  const listen = ({ archiveBucket }) => {
    if (archiveBucket) {
      replaying = true;
      eventReplayer.replayEvents(archiveBucket, handleEvent(eventHandlers)).then(() => {
        replaying = false;
      }).catch(() => {}); // Replay never finishes if it fails
    }
    return (req, res) => {
      return Promise.resolve(req)
        .then(rejectNewEventsWhileReplaying(replaying))
        .then(checkAuth(eventAuthToken))
        .then(parseEvent)
        .then(handleEvent(eventHandlers))
        .then(status => res.sendStatus(status))
        .catch(({ status, error }) => res.status(status).json({ error }));
    };
  };

  return { on, listen };
};


module.exports = createConsumer;
