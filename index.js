module.exports = function (Promise){
	function Stream(resolve, reject, progress){
		if (resolve === undefined) {
			resolve = [];
		}
		if (Array.isArray(resolve)){
			array = resolve;
			resolve = function(r){
				if (array.length === 0) return r([]);
				r([array[0], new Stream(array.slice(1))]);
			}
		}
		Promise.call(this, resolve, reject, progress);
	};
	
	Stream.prototype = Object.create(Promise.prototype);
	
	Stream.empty = new Stream (function (resolve){
		resolve([]);
	});
	
	
	Stream.prototype.notEmpty = function(){
		var self = this;
		return new Stream(function(r){
			self.then(function(rstream){
				if (rstream.length === 0) {
					var e = Error('Stream is empty');
					e.code = "EMPTYSTREAM";
					throw e;
				}
				resolve(rstream[0], rstream[1]);
			})
		});
	};
	
	Stream.prototype.toArray = function (fn) {
		return this.notEmpty()
		.caught(function(e){
			if (e.code === "EMPTYSTREAM") return [];
			else throw e;
		})
		.reduce(function(x,y){
			return Promise
			.all(x.concat([y]));
		}, [] )
	}
	Stream.prototype.map = function (fn) {
		var self = this;
		return self.notEmpty().caught(function(e){
			if (e.code === "EMPTYSTREAM") return [];
			else throw e;
		})
		.sThen(function(x,xs){
			var fx = fn(x),	fxs = xs.map(fn);
			resolve([fx, fxs]);
		});
	};
	
	Stream.prototype.reduce = function (fn, z) {
		var self = this;
		if (z === undefined){
			return self.then(function(){
				
			});
		}
		return new Stream(function(resolve){
			self.then(function(rstream){
				resolve([fn(z,rstream[0]), rstream[1]]);
			})
		});
	}

	Stream.prototype.push = function (x) {
		var self = this;
		return new Stream(function(resolve){
			resolve([x, self]);
		});
	};
	
	
	Stream.prototype.sThen = function(resolve){
		var self = this;
		return new Stream(function(r){
			self.then(function(rstream){
				resolve(rstream[0], rstream[1]);
			})
		})
	}
	
	Stream.prototype.pop = function (fn) {
		var self = this;
		return new Stream(function(resolve){
			self.then(function(rstream){
				fn(stream[0]);
				return stream[1];
			});
		});
	};
	
	Stream.prototype.slice = function () {
		var self = this;
		return new Stream(function(resolve){
			self.then(function(rstream){
				resolve([rstream[0], Stream.empty])
			});
		});
	};
	
	Stream.prototype.write = function(writable){
		function _write(stream){
			stream.then(function(rstream){
				if (rstream[0] === undefined) writable.end();
				//console.log(rstream[0])
				writable.write(new Buffer(rstream[0], 'utf8'), function(){
					_write(rstream[1]);
				});
			});
		};
		_write(this);
	}

	Stream.read = function(readable){
		return new Stream(function(resolve, reject){
			function onData(data){
				removeListeners();
				resolve([data, Stream.read(readable)])
			}
			function onEnd(){
				removeListeners();
				resolve([])
			}
			function onError(e){
				removeListeners();
				reject(e);
			}
			function removeListeners(){
				readable.removeListener('data', onData);
				readable.removeListener('end', onEnd);
				readable.removeListener('error', onError);
			}
			readable.on('data', onData)
			readable.on('end', onEnd);
			readable.on('error', onError);
		});
	};
	
	return Stream;
};