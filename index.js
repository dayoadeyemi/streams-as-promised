var Promise = require('bluebird')
var Stream = require("streams-as-promised")(); 
//new Stream([0,1,2,3])
//	.map(toString)
var s = Stream.read(process.stdin)
	.map(call("toString"))
	.map(call("toUpperCase"))
	.write(process.stdout)
	
var t = Stream.read(process.stdin)
//.map(toString)
//.map(console.log)
	.map(call("toString"))
	//.map(call("toUpperCase"))
		
//var u = Promise.all([s,t]);