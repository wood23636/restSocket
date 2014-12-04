![restSocket Logo](http://i.imgur.com/Zd5SUCi.jpg)

restSocket
==========

`restSocket` is a micro-library that...
- Lets the client act as a WebSockets-powered REST API for the server.
- Lets the client poll the server like a REST API through WebSockets.

## Usage

Just drop it on the page with its dependencies:
```html
<script src="lodash.min.js"></script>
<script src="stomp.min.js"></script>
<script src="restSocket.min.js"></script>
```

Then initiate a restSocket like so:

```js
var todoSocket = new restSocket({
	path: 'localhost:8080/todo',
	login: 'login',
	password: 'password',
	autoReconnect: true,
	onConnect: function(){},
	onConnectionError: function(error){},
	onClose: function(event){}
});
```

Then make requests to the server like so:

```js
// complete example
socket.send('/path/to/destination', 'METHOD', {body:'will be stringified'}, {
	other: headers,
	can: be,
	useful: too
}, notReadyCallback);

// example without headers
socket.send('/path/to/destination', 'METHOD', {body:'will be stringified'});

// example without a body
socket.send('/path/to/destination', 'METHOD', {}, {other:headers, can:be, useful:too});

// example without body or headers, but with a notReadyCallback
socket.send('/path/to/destination', 'METHOD', notReadyCallback);

// example with body but no headers, with notReadyCallback
socket.send('/path/to/destination', 'METHOD', {body:'will be stringified'}, notReadyCallback);

// minimal example
socket.send('/path/to/destination', 'METHOD');
```

Subscribe and unsubscribe:

```js
// complete example with a callback that overrides default operations and additional headers
var mySubscription1 = socket.subscribe('/path/to/destination', callback, {additional:headers});

// examples that doesn't care about other headers but still overrides default operations
var mySubscription2 = socket.subscribe('/path/to/destination', function(message, destinationData){});

// minimal example
var mySubscription3 = socket.subscribe('/path/to/destination');

// unsubscribe from the first subscription
mySubscription1.unsubscribe();
```

### GET Shortcut

A quick shortcut that behaves like old school RESTful GET requests:
```js
todoSocket.get(destination, additionalHeaders, callback, subscriptionHeaders)
```
