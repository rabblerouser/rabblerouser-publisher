const chai = require('chai');
chai.use(require('sinon-chai'));
chai.should();
global.expect = chai.expect;
global.sinon = require('sinon');
global.chai = chai;
