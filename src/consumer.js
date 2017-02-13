'use strict';
const eventReplayer = require('./event-replayer');

class Consumer {
  constructor({eventAuthToken}) {
    this.eventHandlers = {};
    this.replaying = false;
    this.lastSequenceNumberFromBucket = -1;
    this.eventAuthToken = eventAuthToken;

    this.on = this.on.bind(this);
    this.listen = this.listen.bind(this);
    this._checkAuth = this._checkAuth.bind(this);
    this._rejectNewEventsWhileReplaying = this._rejectNewEventsWhileReplaying.bind(this);
    this._bucketEventHandler = this._bucketEventHandler.bind(this);
    this._handleEvent = this._handleEvent.bind(this);
    this._parseEvent = this._parseEvent.bind(this);
  }

  on(eventType, handler) {
    validateEventHandler(eventType, handler);
    this.eventHandlers[eventType] = handler;
  }

  listen({ archiveBucket }) {
    if (archiveBucket) {
      this.replaying = true;
      eventReplayer.replayEvents(archiveBucket, this._bucketEventHandler).then(() => {
        this.replaying = false;
      }).catch(() => {}); // Replay never finishes if it fails
    }
    return (req, res) => {
      return Promise.resolve(req)
        .then(this._checkAuth)
        .then(this._rejectNewEventsWhileReplaying)
        .then(this._parseEvent)
        .then(this._handleEvent)
        .then(status => res.sendStatus(status))
        .catch(({ status, error }) => res.status(status).json({ error }));
    };
  }

  _bucketEventHandler(sequenceNumber, event) {
    return this._handleEvent({ sequenceNumber, event })
      .then(() => {
        this.lastSequenceNumberFromBucket = sequenceNumber;
      });
  }

  _checkAuth(req) {
    if (!req.header('Authorization') || req.header('Authorization') !== this.eventAuthToken) {
      throw { status: 401, error: 'Invalid Authorization header' };
    }
    return req;
  };

  _rejectNewEventsWhileReplaying(req) {
    if (this.replaying) {
      throw { status: 503, error: 'Currently replaying historical events. Try again soon.' };
    }
    return req;
  }

  _parseEvent(req) {
    const event = parseRequestBody(req.body);
    if (!event) {
      throw { status: 400, error: 'Missing or invalid request body' };
    }
    return event;
  };

  _handleEvent({ sequenceNumber, event }) {
    if (sequenceNumber <= this.lastSequenceNumberFromBucket) {
      process.env.NODE_ENV !== 'test' && console.log('Already handled event:', event);
      return 204;
    }

    const eventHandler = this.eventHandlers[event.type];
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
}

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

module.exports = Consumer;
