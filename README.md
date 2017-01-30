# rabblerouser-stream v0.1.0

Rabble Rouser's simplified event publisher. It pushes events to a kinesis stream.

## Installation

Using npm:
```shell
$ npm i -g npm
$ npm i --save git+ssh://git@github.com:rabblerouser/rabblerouser-publisher.git
```

## Usage

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Then use it like this:

```js
// Import the library and initialise it with your kinesis settings
const publisher = require('rabblerouser-publisher');
const publish = publisher({ stream: 'my-stream', region: 'ap-southeast-2' });

// Each event must have a type. This is used for consumers to decide whether they are
// interested in the event, and it will also be used by kinesis for sharding of events.
var event = {
  type: 'registration',
  name: 'Jane Doe',
};

// The publish function returns a Promise.
publish(event)
  .then(result => { ... })
  .catch(error => { ... });
```

### Demo

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

Then run this to publish a hard-coded event to a hard-coded stream:

`npm run demo`
