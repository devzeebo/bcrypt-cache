# bcrypt-cache v1.0

bcrypt-cache is a module designed to reduce CPU usage when frequently doing bcrypt comparisons.

An example use-case would be for verifying API tokens.

If an API token is stored in the database as a bcrypt hash, the overhead to compare the plain-text token to the hash could be up to 250ms, depending on the work factor.  If the API token is used in frequent succession, this can add significant CPU load to the application.

By using bcrypt-cache, the first time the token is received, it'll be compared to the bcrypt hash.  Once verified, a much simpler hash of the token will be stored in the cache and used for future comparisons.

## Installation

```
npm install --save bcrypt-cache
```

## Usage

The `bcrypt-cache` module comes with two default caching mechanisms: Memory and Redis.

### Example usage of the MemoryBcryptCache:

```javascript
var MemoryBcryptCache = require('bcrypt-cache').MemoryBcryptCache;
var memCache = new MemoryBcryptCache({
    ttl: 180,
    pruneTimer: 60
});

function verify (req, res, next) {
    var hash = req.user.get('token');

    // memCache.compare will pull from the cache, if available.
    // If the hash is not in the cache, it'll compare to `hash` then store the result in the cache
    memCache.compare(hash, req.headers['x-access-token'])
        .then(function (result) {
            if (!result) {
                next(new Error('Invalid access token'));
            } else )
                next();
            }
    });
}
```

### MemoryBcryptCache options

| Option | Description |
| ------ | ----------- |
| ttl      | The number of seconds a token will be stored in the cache. Default: `600` |
| pruneTimer | The number of seconds the memory cache will be scanned for expired tokens. Default: `60` |

### RedisBcryptCache options

| Option | Description |
| ------ | ----------- |
| client (required) | A Redis client instance |
| ttl    | The number of seconds a token will be stored in the cache. Default: `600` |
| prefix | A string to use to prefix cache keys in Redis. Default: `redis-cache:` |

## Create your own custom cache

You can create your own cache mechanism (for example, in a database) by inheriting from the BcryptCache class and implementing the three required functions: `_get`, `_set`, and `_remove`.

```javascript
var BcryptCache = require('./bcrypt-cache');
var util = require('util');

function MyCache (options) {
  MyCache.super_.apply(this, arguments);
  // More initialization options here
}

// Inherit from BcryptCache and override the private methods
util.inherits(MyCache, BcryptCache);

// Return a Boolean or Promise.<Boolean>
MyCache.prototype._remove = function (key) {}
// Return a String or Promise.<String>
MyCache.prototype._get = function (key) {}
// Return a Boolean or Promise.<Boolean>
MyCache.prototype._set = function (key, value) {}
```

The three required functions should return a value or Promise that resolves to the appropriate value.

See [memory-cache.js](./lib/memory-cache.js) or [redis-cache.js](./lib/redis-cache.js) for examples.
