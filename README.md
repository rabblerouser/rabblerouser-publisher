# rabblerouser-stream v0.1.0

Rabble Rouser's simplified events streaming client

## Installation

Using npm:
```shell
$ npm i -g npm
$ npm i --save git+ssh://git@github.com:rabblerouser/rabblerouser-stream.git
```

## Usage

First, setup your [AWS config](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

### Producer

```js
const stream = require('rabblerouser-stream');

var params = {
  data: 'I am a harmless little event',
  channel: 'my-channel',
  stream: 'my-stream'
};

stream.producer.publish(params)
.then(result => { ... })
.catch(error => { ... });
```
