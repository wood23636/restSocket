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
	onClose: function(event){},
	api: {
		'/todos': {
			'PATCH': function(payload){},
			'POST': function(payload){}
		},
		'/todos/:id': {
			'PUT': function(payload, args){
				// args.id
			}
		}
	}
});
```

Then make requests to the server like so:

```js
todoSocket.get('todos');

todoSocket.patch('todos/2', {done: true});

todoSocket.post('todos', {description: 'This thing', done: false});

todoSocket.put('todos/1', {id: 2, description: 'Something else', done: false})

todoSocket.remove('todos/1');
```

### Extras / Debugging

`todoSocket.getPaths()` returns your client-side REST API in JSON form.

`todoSocket.getRawSTOMP()` returns the raw STOMP (current connection only).

`todoSocket.getReadyState()` returns whether the connection is ready for requests.

`todoSocket.getRequestQueue()` returns the current request queue.
