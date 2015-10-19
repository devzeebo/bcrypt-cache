"use strict";

var _ = require('lodash');
var BcryptCache = require('./bcrypt-cache');
var when = require('when');
var util = require('util');

/**
 * Create a bcrypt cache that uses Redis to store the cached results
 *
 * @param {Object} options         Settings to use to instantiate the RedisCache
 * @param {Object} options.client  A Redis client instance
 * @param {Number} options.ttl     The number of seconds to store cached credentials; default: 600
 * @param {string} options.prefix  A prefix to append to key names in Redis; default: `bcrypt-cache:`
 * @constructor
 */
function RedisCache (options) {
  RedisCache.super_.apply(this, arguments);
  this.options.ttl = _.get(options, 'ttl', 600);
  this.options.prefix = (_.get(options, 'prefix', 'bcrypt-cache:'));
  this.client = options.client;
}

// Inherit from BcryptCache and override the private methods
util.inherits(RedisCache, BcryptCache);

/**
 * Get a value from the Redis cache from a given key
 *
 * @param {string} key  Cache key
 * @returns {Promise} A Promise containing the value from the cache or `undefined` if nothing was found
 * @private
 */
RedisCache.prototype._get = function (key) {
  var self = this;
  return this.client.getAsync(this.options.prefix + key)
    .timeout(250)
    .tap(function (result) {
      if (result) {
        return self.client.expireAsync(self.options.prefix + key, self.options.ttl)
          .catch(function (err) { self.emit('warn', 'Error setting expiration', err); });
      }
    });
};

/**
 * Add a value to the cache by key
 *
 * @param {string} key    Cache key
 * @param {string} value  Cache value
 * @returns {Promise} A promise that resolves to `true` if the key/value was added to the cache
 * @private
 */
RedisCache.prototype._set = function (key, value) {
  return this.client.setexAsync(this.options.prefix + key, this.options.ttl, value)
    .timeout(250)
    .then(function (result) {
      return Boolean(result);
    });
};

/**
 * Remove a key from the cache
 *
 * @param {cache} key  Cache key
 * @returns {Promise} A Promise that resolves to `true` if the entry was removed
 * @private
 */
RedisCache.prototype._remove = function (key) {
  return this.client.delAsync(this.options.prefix + key).yield(when(true));
};

module.exports = RedisCache;
