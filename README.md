restSocket
==========

`restSocket` is a micro-library that...
- Lets the client act as a WebSockets-powered REST API for the server.
- Lets the client poll the server like a REST API through WebSockets.

`restSocket` requires LoDash or Underscore (tested with LoDash 2.4.1).

## Usage

Just drop it on the page like so:
```html
<script src="restSocket.min.js"></script>
```

Then initiate a restSocket like so:

```js
var todoSocket = new restSocket({
	path: 'localhost:8080/todo', // this is the only required part of this settings object
	authToken: function(){
		// logic to get an authToken
		// this function can be replaced with a simple string
		return '455B1D51-CC4C-40C1-BEFB-579CD18D905B';
	},
	stringifyPayloadToServer: true, // defaults to false
	success: function(){
		// stuff to do after connection is authorized
	},
	error: function(){
		// if an error occurs
	},
	onclose: function(event){
		// stuff to do if/when connection is closed
		// example: you can just try to reopen the connection (it will only do this once every 2 seconds)
		todoSocket.reopen();
	},
	api: {
		'/todos': {
			'PATCH': {
				success: function(payload){
					// you may explicitly define what to do on success and error...
				},
				error: function(err){
					// do stuff if an error happens
				}
			},
			'POST': function(payload){
				// ...or you can just give it one function, which will be called on success only
			}
		},
		'/todos/:id': {
			'PUT': {
				success: function(payload, args){
					// args will be a single-property object with key 'id' and a value based on the resource the server is requesting
				},
				error: function(err){
					// err will be a normal WebSockets error object
					return;
				}
			}
		}
	}
});
```

Then make requests to the server like so:

```js
todoSocket.get('todos');

// you can also specify params for the GET method
todoSocket.get('todos', {filter: 'doneOnly'});

todoSocket.patch('todos/2', {done: true});

todoSocket.post('todos', {description: 'This thing', done: false});

todoSocket.put('todos/1', {id: 2, description: 'Something else', done: false})

// remove initiates a DELETE request
todoSocket.remove('todos/1');
```

### Message Pattern

The message pattern is what will be sent to the server and what the server should be sending back to the client.

```js
{
	resource: '/todos/123',
	method: 'PATCH',
	payload: {
		description: 'This other thing'
	}
}
```

Error messages from the server look like this:

```js
{
	resource: '/todos/123',
	method: 'PATCH',
	error: 'Could not rename "This thing" to "This other thing".'
}
```

### Extras / Debugging

`todoSocket.getPaths()` returns your client-side REST API in JSON form.

`todoSocket.getRawSocket()` returns the raw WebSocket (current connection).

`todoSocket.getReadyState()` returns whether the connection is ready for requests.

`todoSocket.getRequestQueue()` returns the current request queue.

`todoSocket.reopen()` will attempt to reopen the restSocket connection.
