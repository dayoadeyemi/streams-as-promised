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
 module.exports = function (Promise){
	var util = require('util');
	var isArray = util.isArray;
	var K = function (value){ 
		return function (){
			return value
		}
	}
	//Promise.longStackTraces();
	function Stream(resolve, reject, progress){
		var array;
		if (resolve === undefined) {
			resolve = [];
		}
		if (isArray(resolve)){
			array = resolve;
			resolve = function(r){
				if (array.length === 0) return r([]);
				r([array[0], new Stream(array.slice(1))]);
			}
		}
		Promise.call(this, resolve, reject, progress);
		this._readingList = [];
		this._listeners = [];
		this._id = stremNo++;
		stremNo=stremNo+1;
	};
	var stremNo = 0;
	Stream.prototype = Object.create(Promise.prototype);
	
	
	Stream.prototype.next = function(resolve, onEmpty, reject){
		var self = this;
		return new Stream(function(ret){
			ret(self.then(function(x_xs){
				if (!isArray(x_xs)) throw TypeError(self + " is not a Stream, it does not evaluate to an array");
				else if (x_xs.length === 0 ) {
					if (typeof onEmpty === "function" ) return onEmpty();
					else throw Error ("No handler given for the empty stream");
				}
				else if (x_xs[1] && typeof x_xs[1].then !== 'function') throw TypeError(self + " is not a Stream, the second value is not a promise");
				else return resolve(x_xs[0], x_xs[1]);
			}));
		})
	};

	Stream.prototype.consume = function (fn) {
		this.next(function(x,xs){
			fn(x);
			return xs.consume(fn);
		}, function(){
			return ;
		});
	};
	
	Stream.prototype.take = function (n, fn) {
		var self = this;
		if (typeof fn !== 'function'){
			return new Promise (function(resolve){
				self.take(n, resolve)
			});
		}
		if (n === 0) {
			fn([]);
			return this;
		}
		if (typeof n !== "number" || n < 0) throw TypeError('.take expects a non negative integer but got: ' + n)
		return this.next(function(x, xs){
			return xs.take(n-1, function(XS){
				return fn(XS.concat([x]));
			});
		}, K(this));
	};
	
	Stream.pair = function (s, t) {
		return new Stream(function (resolve){
			Promise.all([s, t])
			.spread(function(x, y){
				if (x[0] == undefined || y[0] == undefined) resolve([]);
				resolve([[x[0],y[0]], Stream.pair(x[1],y[1])])
			});
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
			return fn(x) ? [x, xs] : xs.filter(fn);
		}, function(){
			return [];
		});
	};
	
	Stream.prototype.tap = function (fn) {
		return this.map(function(x){
			fn(x);
			return x;
		})
	};
	
	Stream.prototype.reduce = function (fn, z) {
		this.next(function(x,xs){
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
	
	Stream.prototype.pop = function (fn) {
		var self = this;
		return this.next(function(x, xs){
			fn(x);
			return xs
		}, function (){
			throw Error("an attempt was made to pop a value from an empty stream");
		});
	};
		
	Stream.prototype.write = function(writable){
		function writeTo(stream){
			stream.next(function(x,xs){
				writable.write(new Buffer(x, 'utf8'), function(){
					writeTo(rstream[1]);
				});
			}, function (e){
				if (e.code === "EMPTYSTREAM") writable.end();
			});
		};
		writeTo(this);
		return this;
	}
	
	Stream.prototype.stopReading = function Stream$stopReading(readable){
		var i = this._readingList.indexOf(readable);
		if (i === -1) {
			console.log(this._readingList)
			throw new Error('The stream is not reading from the given readable');
		}
		this._listeners[i]();
		this._readingList.splice(i,1);
		this._listeners.splice(i,1);
		if (typeof readable.unref === 'function' &&
			readable.listeners('data' === 0) &&
			readable.listeners('end' === 0) &&
			readable.listeners('error' === 0)) readable.unref();
		return this;
	};
	

	Stream.prototype.read = function(readable){
		var self = this;
		var s = new Stream(function(resolve, reject){
			var readerNo;
			function onData(data){
				removeListeners();
				resolve([data, self.read(readable)])
			}
			function onEnd(){
				removeListeners();
				resolve(self)
			}
			function onError(e){
				removeListeners();
				throw e;
			}
			function removeListeners(){
				self._listeners.splice(readerNo,1);
				readable.removeListener('data', onData);
				readable.removeListener('end', onEnd);
				readable.removeListener('error', onError);
			}
			readerNo = self._listeners.push(onEnd) - 1;
			self._readingList.push(readable);
			readable
			.once('data', onData)
			.once('end', onEnd)
			.once('error', onError);
		});
		return s;
	};
	
	return Stream;
};