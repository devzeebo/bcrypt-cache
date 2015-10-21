"use strict";

var _ = require('lodash');
var when = require('when');
var bcrypt = require('./bcrypt');
var md5 = require('./md5');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Create a new BcryptCache instance
 * @constructor
 */
function BcryptCache () {
  EventEmitter.call(this);
  this.options = {};
}

// Use events to support logging
util.inherits(BcryptCache, EventEmitter);

/**
 * Get a value from the cache from a given key
 *
 * Override this function in a child class to provide the cache's custom `get` functionality
 *
 * @param {string} key The key to lookup in the cache
 * @returns {Promise}
 * @private
 */
BcryptCache.prototype._get = function (key) {
  return when.reject(new Error('Not implemented'));
};

/**
 * Add a value to the cache
 *
 * Override this function in a child class to provide the cache's custom `set` functionality
 *
 * @param {string} key   Cache key
 * @param {string} value Cache value
 * @returns {Promise}
 * @private
 */
BcryptCache.prototype._set = function (key, value) {
  return when.reject(new Error('Not implemented'));
};

/**
 * Remove a key from the cache
 *
 * Override this function in a child class to provide the cache's custom `get` functionality
 *
 * @param {string} key Cache key
 * @returns {Promise}
 * @private
 */
BcryptCache.prototype._remove = function (key) {
  return when.reject(new Error('Not implemented'));
};

/**
 * Create a simple (work-factor 4) bcrypt hash that's faster to compare
 *
 * Override this function in a child class to provide custom hashing
 *
 * @param {string} value A string to hash
 * @returns {Promise} A Promise that resolves to a bcrypt hash string
 * @private
 */
BcryptCache.prototype._hash = function (value) {
  return bcrypt.hash(value, 4);
};

/**
 * Compare a plain text value to a hash
 *
 * Override this function in a child class to provide custom hash comparison
 *
 * @param {string} hash  A bcrypt hash string
 * @param {string} value A plain-text string to compare to the value
 * @returns {Promise}
 * @private
 */
BcryptCache.prototype._compare = function (hash, value) {
  return bcrypt.compare(value, hash);
};

BcryptCache.prototype.get = function (hash) {
  var self = this;
  return when(this._get(md5(hash)))
    .catch(function (err) {
      self.emit('warn', new Error('Failed to get data from the cache'), err);
    });
};

BcryptCache.prototype.set = function (hash, token) {
  var self = this;
  if (hash == null || token == null) {
    self.emit('warn', new TypeError('Missing parameter(s)'));
    return when(false);
  }

  return this._hash(token)
    .then(function (result) {
      return when(self._set(md5(hash), result));
    })
    .catch(function (err) {
      self.emit('warn', new Error('Failed add hash to the cache'), err);
    });
};

BcryptCache.prototype.compare = function (hash, token) {
  var self = this;
  var needsSave = false;
  return self.get(hash)
    .then(function (result) {
      if (!result) {
        needsSave = true;
        return hash;
      }
      return result;
    })
    .then(function (result) {
      return self._compare(result, token);
    })
    .tap(function (result) {
      if (result === true && needsSave) {
        return self.set(hash, token);
      }
    });
};

BcryptCache.prototype.remove = function (hash) {
  return when(this._remove(md5(hash)));
};

module.exports = BcryptCache;
