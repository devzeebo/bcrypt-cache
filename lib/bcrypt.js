"use strict";

module.exports = (function () {
  var when = require('when/node');
  var bcrypt;
  try {
    bcrypt = require('bcrypt');
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') { throw e; }
    bcrypt = require('bcryptjs');
  }

  // Create promisified versions of the bcrypt functions
  bcrypt.hash = when.lift(bcrypt.hash);
  bcrypt.compare = when.lift(bcrypt.compare);

  return bcrypt;
})();
