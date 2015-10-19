var chai = require('chai');
global.sinon = require('sinon');
var sinonChai = require('sinon-chai');
require('sinon-as-promised');
global.should = chai.should();
//global.expect = chai.expect;
chai.use(sinonChai);
chai.use(require('chai-as-promised'));
