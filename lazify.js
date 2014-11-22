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

var EventEmitter = require('events').EventEmitter;
var debug = false ? console.log : function (){};
var Promise = require('bluebird')

function LazyPromise(resolve, reject, progress, parent){
	this.id = ++count;
	var self = this;
	debug("    ", self.id, " created");
	this._activated = false;
	this._activator = new EventEmitter();
	this._activator.once('active', function(){
		debug("\t", self.id, " activated");
		self._activated = true;
	});
	if (parent) {
		debug("\t", parent.id, " << ", this.id);
		self._activator.once('active', function(){
			parent._activator.emit('active');
		});
	}
	Promise.call(self, function(ret){
		self._activator.once('active', function(){
			debug("\t", self.id, " resolving");
			resolve(function(){
				debug("\t", self.id, " resolved");
				ret.apply(ret, arguments)
			});
		});
	}, reject, progress);

};
var count = 0;
LazyPromise.prototype = Object.create(Promise.prototype);

LazyPromise.coerce = function (promise){
  return new LazyPromise(function(resolve){
    promise.then(function(x){ resolve(x); });
  });
};

LazyPromise.prototype.toString = function Promise$toString() {
	return "[object LazyPromise]";
};

LazyPromise.prototype.asap = function (){
	this.activate();
	return Promise.prototype._then.apply(this, arguments);
}

LazyPromise.prototype._then = function (){
	var self = this;
	var args = arguments;
	return new LazyPromise(function(resolve){
		resolve(Promise.prototype._then.apply(self, args));
	}, void 0, void 0, this);
};

LazyPromise.prototype.activate = function(p) {
	var self = this;
	if (p instanceof LazyPromise){
		debug("\t", this.id, " <f< ", p.id)
		if (p._activated)  {
			this._activator.emit('active');
		} else {
			p._activator.once('active', function(){
				self._activator.emit('active');
			})
		}
	}
	else this._activator.emit('active');
	return this;
};

module.exports = LazyPromise;