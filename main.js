//TODO: Design this so different streams technologies can be plugged in at some point(like nodemailer).

function put(params) {
  console.log('put event to stream.');
}

function producer() {
  return {
    put: put
  };
}

function get(params) {
  console.log('getting event from stream.');
}

function consumer() {
  return {
    get: get
  };
}

module.exports = {
  producer: producer(),
  consumer: consumer(),
};
