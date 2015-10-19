"use strict";

var _ = require('lodash');
var BcryptCache = require('./bcrypt-cache');
var util = require('util');
var md5 = require('./md5');
var when = require('when');

/**
 * Create a bcrypt cache that uses Redis to store the cached results
 *
 * @param {Object} options             Settings to use to instantiate the MemoryCache
 * @param {Number} options.pruneTimer  In seconds, how frequently to prune expired tokens from the cache; default: 60
 * @param {Number} options.ttl         The number of seconds to store cached credentials; default: 600
 * @constructor
 */
function MemoryCache (options) {
  MemoryCache.super_.apply(this, arguments);
  this.options.ttl = _.get(options, 'ttl', 600) * 1000;
  this.options.pruneTimer = _.get(options, 'pruneTimer', 60) * 1000;
  this.cache = {};
  // Start a timer to periodically prune the memory cache of expired keys
  setInterval(function () { this._prune(); }.bind(this), this.options.pruneTimer);
}

// Inherit from BcryptCache and override the private methods
util.inherits(MemoryCache, BcryptCache);

/**
 * Prune expired values from the hash map
 * @private
 */
MemoryCache.prototype._prune = function () {
  var now = Date.now();
  _.each(_.keys(this.cache), function (key) {
    if (this.cache[key] && this.cache[key].expiration < now) {
      this._remove(key);
    }
  }, this);
};

/**
 * Remove a key from the cache
 * @param {string} key The key to remove
 * @returns {boolean}
 * @private
 */
MemoryCache.prototype._remove = function (key) {
  delete this.cache[key];
  return !_.has(this.cache, key);
};

/**
 * Get a cached value by key
 * @param {string} key The key to find
 * @returns {string|undefined} Returns the value of the key, or `undefined` if the key is not found or has expired
 * @private
 */
MemoryCache.prototype._get = function (key) {
  var value = _.get(this.cache, key);
  if (value) {
    if (value.expiration < Date.now()) {
      this.remove(key);
      return void 0;
    } else {
      value.expiration = Date.now() + this.options.ttl;
    }
    return value.value;
  }
};

/**
 * Add a value to the cache with a given key
 * @param {string} key    Cache key
 * @param {string} value  Cache value
 * @returns {boolean}
 * @private
 */
MemoryCache.prototype._set = function (key, value) {
  this.cache[key] = {
    value: value,
    expiration: Date.now() + this.options.ttl
  };
  return _.has(this.cache, key);
};

/**
 * Use MD5 as the hash algorithm for the in-memory hash map since it's unlikely that the memory value can be read maliciously
 *
 * @param {string} value String to hash
 * @returns {Promise.<string>} A Promise that resolves to a hash string
 * @private
 */
MemoryCache.prototype._hash = function (value) {
  return when(md5(value));
};

/**
 * Use MD5 as the hash algorithm for the in-memory hash map
 *
 * @param {string} hash  An MD5 or bcrypt hash string
 * @param {string} value A plain-text string to compare against the hash
 * @returns {Promise.<boolean>} A Promise that resolves to `true` if the value matches the hash
 * @private
 */
MemoryCache.prototype._compare = function (hash, value) {
  if (hash.length === 32) {
    // If the hash is an MD5, then it must have come from the memory cache
    return when(md5(value) === hash);
  } else {
    // Otherwise use the default comparison function
    return MemoryCache.super_.prototype._compare.call(this, hash, value);
  }
};

module.exports = MemoryCache;
