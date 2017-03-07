'use strict';
const eventReplayer = require('./event-replayer');

class Listener {
  constructor(settings) {
    this.authToken = settings.listenWithAuthToken;
    this.archiveBucketSettings = settings.readArchiveFromBucket ? {
      bucket: settings.readArchiveFromBucket,
      region: settings.region,
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
      endpoint: settings.s3Endpoint,
    } : null;
    this.eventHandlers = {};
    this.replaying = false;
    this.lastSequenceNumber = -1;

    this.on = this.on.bind(this);
    this.listen = this.listen.bind(this);
    this._checkAuth = this._checkAuth.bind(this);
    this._rejectNewEventsWhileReplaying = this._rejectNewEventsWhileReplaying.bind(this);
    this._bucketEventHandler = this._bucketEventHandler.bind(this);
    this._handleEvent = this._handleEvent.bind(this);
    this._parseRequest = this._parseRequest.bind(this);
  }

  on(type, handler) {
    validateEventHandler(type, handler);
    this.eventHandlers[type] = handler;
  }

  listen() {
    if (this.archiveBucketSettings) {
      this.replaying = true;
      eventReplayer.replayEvents(this.archiveBucketSettings, this._bucketEventHandler).then(() => {
        // This happens after *all* events from the bucket have been replayed
        this.replaying = false;
      }).catch(process.env.NODE_ENV === 'test' ? () => {} : console.error); // Replay never finishes if it fails
    }
    return (req, res) => {
      return Promise.resolve(req)
        .then(this._checkAuth)
        .then(this._rejectNewEventsWhileReplaying)
        .then(this._parseRequest)
        .then(this._handleEvent)
        .then(status => res.sendStatus(status))
        .catch(({ status, error }) => res.status(status).json({ error }));
    };
  }

  _bucketEventHandler(sequenceNumber, data) {
    const event = parseKinesisEvent({ sequenceNumber, data });
    return Promise.resolve(this._handleEvent(event));
  }

  _checkAuth(req) {
    if (!req.header('Authorization') || req.header('Authorization') !== this.authToken) {
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

  _parseRequest(req) {
    const event = parseKinesisEvent(req.body);
    if (!event) {
      throw { status: 400, error: 'Missing or invalid request body' };
    }
    return event;
  };

  _handleEvent({ sequenceNumber, event }) {
    if (sequenceNumber <= this.lastSequenceNumber) {
      process.env.NODE_ENV !== 'test' && console.log(`Already handled event ${sequenceNumber}`);
      return 204;
    }

    const eventHandler = this.eventHandlers[event.type];
    if (!eventHandler) {
      process.env.NODE_ENV !== 'test' && console.log(`Ignoring event ${sequenceNumber}`);
      return 204;
    }

    process.env.NODE_ENV !== 'test' && console.log(`Handling event ${sequenceNumber}:`, event);
    return eventHandler(event.data).then(
      () => {
        this.lastSequenceNumber = sequenceNumber;
        return 200;
      },
      error => { throw { status: 500, error }; }
    );
  };
}

const validateEventHandler = (type, handler) => {
  if (!type) {
    throw new Error('No event type defined for handler.');
  }

  if (!handler || typeof handler !== 'function') {
    throw new Error('Invalid event handler.');
  }
};

const parseKinesisEvent = kinesisEvent => {
  if (!kinesisEvent) return null;
  if (!kinesisEvent.data) return null;
  if (!kinesisEvent.sequenceNumber) return null;
  try {
    return {
      sequenceNumber: parseInt(kinesisEvent.sequenceNumber),
      event: JSON.parse(new Buffer(kinesisEvent.data, 'base64')),
    };
  } catch(e) {
    return null;
  }
};

const createListener = settings => {
  if (!settings.listenWithAuthToken) {
    // It's ok to not specify a token - you just won't be able to listen for events
    const throwError = msg => () => { throw new Error(msg); };
    return {
      on: throwError('Cannot register an event handler - stream client was configured without listenWithAuthToken'),
      listen: throwError('Cannot listen for events - stream client was configured without listenWithAuthToken'),
    };
  }
  if (settings.readArchiveFromBucket) {
    // Bucket is not required, but if you *do* specify one, then you need these settings too
    if (!settings.region) { throw new Error('Settings contains an archive bucket but no region'); }
    if (!settings.accessKeyId) { throw new Error('Settings contains an archive bucket but no accessKeyId'); }
    if (!settings.secretAccessKey) { throw new Error('Settings contains an archive bucket but no secretAccessKey'); }

  }
  return new Listener(settings);
}

module.exports = createListener;
