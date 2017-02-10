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
  if (!body.sequenceNumber && body.sequenceNumber !== 0) return null;
  try {
    return {
      sequenceNumber: body.sequenceNumber,
      event: JSON.parse(new Buffer(body.data, 'base64')),
    };
  } catch(e) {
    return null;
  }
};

const checkAuth = eventAuthToken => req => {
  if (!req.header('Authorization') || req.header('Authorization') !== eventAuthToken) {
    throw { status: 401, error: 'Invalid Authorization header' };
  }
  return req;
};

const rejectNewEventsWhileReplaying = replaying => req => {
  if (replaying) {
    throw { status: 503, error: 'Currently replaying historical events. Try again soon.' }
  }
  return req;
}

const parseEvent = req => {
  const event = parseRequestBody(req.body);
  if (!event) {
    throw { status: 400, error: 'Missing or invalid request body' };
  }
  return event;
};

const handleEvent = (lastSequenceNumberFromBucket, eventHandlers) => ({ sequenceNumber, event }) => {
  if (sequenceNumber <= lastSequenceNumberFromBucket) {
    process.env.NODE_ENV !== 'test' && console.log('Already handled event:', event);
    return 204;
  }

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
  let lastSequenceNumberFromBucket = -1;

  const on = (eventType, handler) => {
    validateEventHandler(eventType, handler);
    eventHandlers[eventType] = handler;
  };

  const listen = ({ archiveBucket }) => {
    if (archiveBucket) {
      replaying = true;
      const bucketEventHandler = (sequenceNumber, event) => {
        return handleEvent(lastSequenceNumberFromBucket, eventHandlers)({ sequenceNumber, event })
          .then(() => {
            lastSequenceNumberFromBucket = sequenceNumber;
          });
      };

      eventReplayer.replayEvents(archiveBucket, bucketEventHandler).then(() => {
        replaying = false;
      }).catch(() => {}); // Replay never finishes if it fails
    }
    return (req, res) => {
      return Promise.resolve(req)
        .then(checkAuth(eventAuthToken))
        .then(rejectNewEventsWhileReplaying(replaying))
        .then(parseEvent)
        .then(handleEvent(lastSequenceNumberFromBucket, eventHandlers))
        .then(status => res.sendStatus(status))
        .catch(({ status, error }) => res.status(status).json({ error }));
    };
  };

  return { on, listen };
};


module.exports = createConsumer;
