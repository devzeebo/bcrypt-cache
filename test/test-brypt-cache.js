"use strict";

var _ = require('lodash');
var TA = require('../index');
var bcrypt = require('../lib/bcrypt');
var sinon = require('sinon');
var when = require('when');
var whenNode = require('when/node');
var withData = require('./lib/withData').withData;
var MockRedis = require('fakeredis');

describe('Token Authentication Cache', function () {
  var token = 'token';
  var tokenHash = '$2a$10$o4ezyhBv1b2tOQmHH1kiO.vdeIPLQQcY.1aCtH9VODTK.1/CpyRPa';

  function createMockRedis() {
    var r, p;
    r = MockRedis.createClient(null, null, { fast: true });
    p = MockRedis.RedisClient.prototype;
    r.flushdbAsync = whenNode.lift(p.flushdb.bind(r));
    return r;
  }

  withData({
    'With MemoryCache': [TA.MemoryBcryptCache, { ttl: 1, pruneTimer: 10 }],
    'With RedisCache': [TA.RedisBcryptCache, { ttl: 1, redis: true }]
  }, function (Ctor, options) {
    var t;

    before(function () { sinon.spy(bcrypt, 'compare'); });
    after(function () { bcrypt.compare.restore(); });

    // Replace redis client with a mock client
    beforeEach(function () {
      if (options.redis) {
        options.client = createMockRedis();
      }
      t = new Ctor(options);
      sinon.spy(t, '_compare');
    });

    it('should have required functions', function () {
      t.get.should.be.a('function');
      t.set.should.be.a('function');
      t.remove.should.be.a('function');
      t.compare.should.be.a('function');
    });

    it('should store a key and retrieve it', function () {
      return t.set(tokenHash, token).
      then(function (result) {
        result.should.be.true;
        return t.get(tokenHash);
      }).
      then(function (result) {
        result.should.be.a('string');
      });
    });

    it('should not get a non-existant key', function () {
      return t.get('otherkey').
      then(function (result) {
        should.not.exist(result);
      });
    });

    it('should verify a key from the cache', function () {
      return t.set(tokenHash, token).
      then(function () {
        return t.compare(tokenHash, token);
      }).
      then(function (result) {
        // Make sure we didn't compare against `tokenHash`, but the cached hash
        t._compare.should.have.been.called;
        t._compare.lastCall.args[0].should.not.equal(tokenHash);
        if (t instanceof TA.RedisBcryptCache) {
          bcrypt.compare.lastCall.args[1].should.match(/^\$2a\$04\$/);
        } else {
          t._compare.lastCall.args[0].should.equal('94a08da1fecbb6e8b46990538c7b50b2');
        }
        result.should.be.true;
      });
    });

    it('should verify a key that is not in the cache', function () {
      return t.get(tokenHash).
      then(function (result) {
        should.not.exist(result);
        return t.compare(tokenHash, token);
      }).
      then(function (result) {
        result.should.be.true;
        // Make sure that we're saving the result to the cache
        t._compare.should.have.been.called;
        t._compare.lastCall.args[0].should.equal(tokenHash);
        t._compare.lastCall.args[1].should.equal(token);
        if (t instanceof TA.RedisBcryptCache) {
          bcrypt.compare.lastCall.args[1].should.equal(tokenHash);
        }
        return t.get(tokenHash);
      }).
      then(function (result) {
        should.exist(result);
        if (t instanceof TA.RedisBcryptCache) {
          result.should.match(/^\$2a\$04\$/);
        } else {
          result.should.equal('94a08da1fecbb6e8b46990538c7b50b2');
        }
      });
    });

    it('should verify a key if lookup fails', function () {
      sinon.stub(t, '_get').rejects(new Error('Connection closed'));
      return t.compare(tokenHash, token).
        then(function (result) {
          result.should.be.true;
        });
    });

    it('should verify if saving key to the cache fails', function () {
      sinon.stub(t, '_set').rejects(new Error('Connection closed'));
      return t.compare(tokenHash, token).
        then(function (result) {
          result.should.be.true;
        });
    });

    it('should not verify a key that is not in the cache', function () {
      return t.get('key').
      then(function (result) {
        should.not.exist(result);
        return t.compare('token123', tokenHash);
      }).
      then(function (result) {
        result.should.be.false;
      });
    });

    it('should not verify a key from the cache', function () {
      return t.set('key', token).
      then(function () {
        return t.compare('token123', tokenHash);
      }).
      then(function (result) {
        result.should.be.false;
      });
    });

    it('should remove a key', function () {
      return t.set('key', token).
      then(function () {
        return t.remove('key');
      }).
      then(function (result) {
        result.should.be.true;
        return t.get('key');
      }).
      then(function (result) {
        should.not.exist(result);
      });
    });

    it('should remove a non-existant key', function () {
      return t.remove('otherkey').
      then(function (result) {
        result.should.be.true;
      });
    });
  });

  describe('expiration', function () {
    describe('with RedisCache', function () {
      // Use timekeeper here because `fakeredis` uses setTimeout and the promises
      // will hang because the timers will never fire.
      var clock, t;
      before(function () { clock = require('timekeeper'); });
      beforeEach(function () { t = new TA.RedisBcryptCache({ client: createMockRedis(), ttl: 1 }); });
      after(function () { clock.reset(); });

      it('should prune expiring cache keys', function () {
        return t.set('key', token).
        then(function () {
          clock.travel(Date.now() + 2000);
          return t.get('key');
        }).
        then(function (result) {
          should.not.exist(result);
        });
      });

      it('should reset expiration on get', function () {
        return t.set('key', token).
        then(function () {
          clock.travel(Date.now() + 900);
          return t.get('key');
        }).
        then(function (result) {
          should.exist(result);
          clock.travel(Date.now() + 900);
          return t.get('key');
        }).
        then(function (result) {
          should.exist(result);
          clock.travel(Date.now() + 2000);
          return t.get('key');
        }).
        then(function (result) {
          should.not.exist(result);
        });
      });
    });

    describe('with MemoryCache', function () {
      var clock, t;
      beforeEach(function () {
        clock = sinon.useFakeTimers();
        t = new TA.MemoryBcryptCache({ ttl: 1, pruneTimer: 5 });
      });
      after(function () { clock.reset(); });

      it('should prune expiring cache keys', function () {
        sinon.spy(t, '_prune');
        return t.set('key', token).
        then(function () {
          clock.tick(10000);
          // Make sure the value was pruned before the get
          t._prune.should.have.been.called;
          _.has(t, "cache['3c6e0b8a9c15224a8228b9a98ca1531d']").should.be.false;
          return t.get('key');
        }).
        then(function (result) {
          should.not.exist(result);
        });
      });

      it('should reset expiration on get', function () {
        sinon.spy(t, '_get');
        sinon.spy(t, '_set');
        return t.set('key', token).
        then(function () {
          _.get(t, "_set.lastCall.thisValue.cache['3c6e0b8a9c15224a8228b9a98ca1531d']" +
            ".expiration").should.equal(1000);
          clock.tick(900);
          return t.get('key');
        }).
        then(function (result) {
          should.exist(result);
          _.get(t, "_get.lastCall.thisValue.cache['3c6e0b8a9c15224a8228b9a98ca1531d']" +
            ".expiration").should.equal(1900);
          clock.tick(900);
          return t.get('key');
        }).
        then(function (result) {
          should.exist(result);
          _.get(t, "_get.lastCall.thisValue.cache['3c6e0b8a9c15224a8228b9a98ca1531d']" +
            ".expiration").should.equal(2800);
          clock.tick(5000);
          return t.get('key');
        }).
        then(function (result) {
          should.not.exist(result);
        });
      });
    });
  });
});

