## streams-as-promised

Your streams are now promises in your favourite promise library, so you no longer have to choose between using streams and functional programming. An instance of a stream in this sense is either the empty Stream (a promise of an empty Array) or a promise of both a dynamic value and Stream.
```haskell
    Stream :: EmptyStream | Promise [Dynamic, Stream]
```
## Intro

    npm install streams-as-promised

then 

```js
var Stream = require('streams-as-promised')(Promise);
```
where ```Promise```` is your favourite promise library (bluebird is advised).


## Examples

To create a stream from an array:
```js
var stream = new Stream([0,1,2,3]);
```

To read from a node readable stream:
```js
var stream = (new Stream()).read(readable);
```


To write to a node writable stream:
```js
var sameStreamForChaining = stream.write(writable);
```


To apply a function ```fn``` to every value in a stream:
```js
var mappedStream = stream.map(fn);
```

using the .then function will return a promise of an array, if you want to chain streams use
```haskell
    Stream.prototype.next(Function onResolved, Function ifEmpty, [Function onRejected]) -> Stream
```
here
```haskell
    onResolved(Dynamic x, Stream xs) -> Stream | [Dynamic, Stream]
    ifEmpty() -> Stream
    onRejected(Dynamic reason) -> Stream
```
e.g.
```js
var streamOfTypes = stream.next(function(x,xs){
	return [typeof x, xs];
}, function(){
	return z;
});
```
