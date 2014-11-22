/**
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Ifedayo Adeyemi
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:</p>
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
 "use strict";
var util = require('util');
var isArray = util.isArray;
var isNumber = function (x) { return typeof x === 'number'; };
var debug = false ? console.log : function (){};
var LazyPromise = require('./lazify.js');
var Promise = require('bluebird')

var K = function (value){ 
	return function (){
		return value;
	}
}
var I = function (value){ 
	return value;
}


var replace = function replace(list, before, after) {
    var newList = list.slice(0);
    var index = list.indexOf(before);
    var len = list.length;
    for (var i = 0; i<len; i++){
      if (list[i] === before) {
        if (after === undefined) {
          newList[i] = list[len-1];
          newList.pop();
        }
        else newList[i] = after;
        return newList;
      }
    }
    return newList;
}

function Stream(resolver){
	debug("new stream")
	var array;
	var self = this;
	if (resolver === undefined) {
		resolver = [];
	}
	if (isArray(resolver)){
		array = resolver;
		resolver = function(r){
			if (array.length === 0) return r([]);
			r([array[0], new Stream(array.slice(1))]);
		}
	}
	LazyPromise.call(this, resolver.bind(this));
};
Stream.prototype = Object.create(LazyPromise.prototype);

Stream.prototype.next = function(resolve, onEmpty, reject){
	var self = this;
	debug("called next on", self.id)
	return new Stream(function(ret){
		debug("creating promise of next value and tail")
		var p = self.asap(function(x_xs){
			if (!isArray(x_xs)) throw TypeError(self + " is not a Stream, it does not evaluate to an array");
			else if (x_xs.length === 0 ) {
				if (typeof onEmpty === "function" ) return onEmpty();
				else throw Error ("No handler given for the empty stream");
			}
			else if (x_xs[1] && typeof x_xs[1].then !== 'function') throw TypeError(self + " is not a Stream, the second value is not a promise");
			else return resolve.bind(self)(x_xs[0], x_xs[1]);
		}, reject);
		ret(p)
	});
};

Stream.empty = function () {
	debug("create empty stream")
	return new Stream(function (resolve){
		resolve([]);
	}).activate();
};

var _race = function(promises, outStream){
  promises.forEach(function(promise, index){
    promise.then(function(x,i){
      resolve([x, xs]);
    })
  })
}

Stream.race = function (promises) {
	debug("create stream from promises");
  var resolveNext;
  
  var createRacer = function (){
    return new Stream(function(resolve){
      resolveNext = function (x){
        resolve([x, createRacer()])
      };
    });
  }
  
  promises.forEach(function (p){
    p.then(resolveNext);
  });
  return createRacer();
};

Stream.race = function (promises) {
	debug("create stream from promises");
  var singleton = function(p){
    return new Stream(function(resolve){
      p.then(function(x){
        resolve([x,Stream.empty()]);
      });
    });
  }
  return Stream.mix(promises.map(singleton));
};

Stream.range = function (start, end) {
  start = start === undefined ? 0 : start;
	debug("create [", start, "..", end || "","]")
	return new Stream(function (resolve){
    resolve(end === undefined || end >= start ? [start, Stream.range(start+1, end)] : []);
	});
};

Stream.list = function () {
  var args = Array.prototype.slice.call(arguments, 0);
  function _listBuilder(current){
    var _next = function (current){
      var add = function(x,y){  return x+y; };
      if (current.length === 1) return [current[0]+1];
      var restC = current.slice(1);
      var restN = _next(restC);
      var restSumC = restC.reduce(add, 0);
      var restSumN = restN.reduce(add, 0);
      return restSumC === restSumN ? [current[0]].concat(restN) :
        current[0] > 0 ? [current[0]-1].concat(restN) :
        [restSumN].concat(restN.map(K(0)));
      
    };
    var nextSet = _next(current);
    var s = new Stream(function (resolve){
      resolve([nextSet, _listBuilder(nextSet)]);
    });
    var _where = function(query){
      var fn = Function.constructor.apply(null, args.concat(['return '+query+';']));
      var res = this.filter(function(params){
        return fn.apply(fn, params)
      });
      res.where = _where.bind(res);
      return res;
    };
    s.where = _where.bind(s);
    return s;
  }
	return _listBuilder(args.map(K(0)));
};

Stream.pair = function (streams) {
  function pluck(list, item){ list.map(function(){ return list[item]; }); }
	return new Stream(function (resolve){
		Promise.all(streams)
		.then(function(resolvedStreams){
			resolve([resolvedStreams(0), resolvedStreams(1)])
		});
	});
};

Stream.mix = function (streams) {
  debug("creating mix", streams.map( function(stream){ return stream.id+" "; }).join())
	return new Stream(function(resolve){
    var promises = streams.map( function(stream){
      return stream.next(function(x,xs){
        return [x, Stream.mix(replace(streams, stream, xs))];
      }, K(Stream.mix(replace(streams, stream)))).activate();
    });
        
		resolve(Promise.any(promises));
	});
};

// Stream.mix = function (Sx, Sy) {
  // debug("creating mix", Sx.id, Sy.id)
	// return new Stream(function(resolve){
		// resolve(Promise.any([
			// Sx.next(function(x,xs){ return [x, Stream.mix(xs, Sy)]; }, K(Sy)).activate(),
			// Sy.next(function(y,ys){ return [y, Stream.mix(Sx, ys)]; }, K(Sx)).activate()
		// ]));
	// });
// };

Stream.prototype.consume = function (fn) {
	return this.next(function(x,xs){
		fn(x);
		return xs
      .consume(fn)
      .activate();
	}, function(){
		return this;
	});
};


Stream.prototype.map = function (fn) {
	return this.next(function(x,xs){
		return [fn(x), xs.map(fn)];
	}, function(){
		return [];
	});
};

Stream.prototype.filter = function (fn) {
	return this.next(function(x,xs){
		return fn(x) ? [x, xs.filter(fn)] : xs.filter(fn).activate();
	}, function(){
		return [];
	});
};

Stream.prototype.tapEach = function (fn) {
	return this.map(function(x){
		fn(x);
		return x;
	})
};

Stream.prototype.reduce = function (fn, z) {
	return this.next(function(x,xs){
		return xs.reduce(fn, fn(z,x));
	}, function(){
		return z;
	});
}

Stream.prototype.push = function (x) {
	var self = this;
	return new Stream(function(resolve){
		resolve([x, self]);
	});
};

Stream.prototype.drop = function (n) {
	var self = this;
	debug("drop", n, "from", this.id);
	if (typeof n !== "number" || n < 0) throw TypeError('.drop(n) expects a non-negative integer n, but got n = ' + n);
	if (n === 0) return this;
	return this.next(function(x,xs){
		return xs.drop(n-1).activate();
	}, function (){
		return Stream.empty()
	});
};

Stream.prototype.take = function (n) {
	var self = this;
	debug("taking", n, "from", this.id);
	if (n === 0) {
		return new Promise(function(resolve){
			resolve([]);
		});
	}
	if (n === undefined || n < 0) n = 0;
	if (typeof n !== "number" || n < -1) throw TypeError('.take(n) expects a non-negative integer n, but got n = ' + n);
	return this.asap(function(x_xs){
		if (x_xs.length === 0) throw Error("an attempt was made to take a value from an empty stream");
		var x = x_xs[0], xs = x_xs[1];
		return xs.take(n-1)
		.then(function(XS){
			return [x].concat(XS);
		})
	});
};

Stream.prototype.pop = function () {
	return this.take(1).then(function(x){
		return x[0];
	});
};

Stream.prototype.mix = function (x, y) {
	return y ? Stream.mix(this, Array.prototype.slice.call(arguments, 0)) : Stream.mix(this, x);
};

Stream.prototype.write = function(writable){
	this.next(function(x,xs){
		writable.write(new Buffer(x, 'utf8'), function(){
			xs.write(writable)
		});
	}, function (){
		try{ writable.end() } catch (e) { }
	}).activate(this);
	return this;
};

Stream.read = function(readable, parent){
	return new Stream(function(resolve, reject){
		var readerNo;
    var self = this;
		function onData(data){
			removeListeners();
			resolve([data, Stream.read(readable, self)])
		}
		function onEnd(){
			removeListeners();
			resolve([]);
			if (typeof readable.unref === 'function' &&
				readable.listeners('data').length === 0) readable.unref();
		}
		function onError(e){
			removeListeners();
			throw e;
		}
		function removeListeners(){
			readable.removeListener('data', onData);
			readable.removeListener('end', onEnd);
			readable.removeListener('error', onError);
		}
		this.stopReading = onEnd;
		if (parent && parent.stopReading) parent.stopReading = onEnd;
		readable
		.once('data', onData)
		.once('end', onEnd)
		.once('error', onError);
	});
};
	
module.exports = Stream;