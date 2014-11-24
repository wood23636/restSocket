/*!
 * RestSocket v0.2.1
 * https://github.com/bracketdash/restSocket
 * 
 * A library for:
 * Letting the client act as a WebSockets-powered REST API for the server.
 * Letting the client poll the server like a REST API through WebSockets.
 * 
 * Requires STOMP v2.3.4 and LoDash v2.4.1
 * 
 * Copyright 2014 Michael Hatch
 * Released under the MIT license
 */

(function(){
	
	function restSocket(settings){
		
		// error message handler
		function error(msg){
			throw 'restSocket Error: ' + msg;
			return false;
		}
		
		// throw errors immediately if the browser doesn't support WebSockets or they didn't include required settings
		if(!("WebSocket" in window)){
			return error('WebSockets is not supported in this browser.');
		}
		if(typeof settings !== 'object' || typeof settings.path !== 'string' || typeof settings.login !== 'string' || typeof settings.password !== 'string'){
			return error('restSocket requires a settings object with at least a path, login, and password.');
		}
		
		// keep track of stuff
		var S = this;
		S.ready = false;
		
		// split the path into regexp pattern and keys
		function explodePath(path) {
			var ret = {
					originalPath: path,
					regexp: path
				},
				keys = ret.keys = [];
			path = path.replace(/([().])/g, '\\$1').replace(/(\/)?:(\w+)([\?\*])?/g,
				function(_, slash, key, option) {
					var optional = option === '?' ? option : null;
					var star = option === '*' ? option : null;
					keys.push({
						name: key,
						optional: !!optional
					});
					slash = slash || '';
					return '' + (optional ? '' : slash) + '(?:' + (optional ? slash : '') + (
						star && '(.+?)' || '([^/]+)') + (optional || '') + ')' + (optional || '');
				}).replace(/([\/$\*])/g, '\\$1');
			ret.regexp = new RegExp('^' + path + '$', 'i');
			return ret;
		}
		
		// produce a more digestible paths object based on the API
		S.paths = [];
		if(typeof settings.api === 'object'){
			_.each(settings.api, function(apiMethods, apiPath){
				var path = explodePath(apiPath);
				path.methods = apiMethods;
				S.paths.push(path);
			});
		}
		
		S.handleServerRequest = function(message){
			_.each(S.paths, function(path){
				if(path.regexp.test(message.headers.subscription)){
					var matches = message.headers.subscription.match(path.regexp);
					var args = {};
					_.each(path.keys, function(key, index){
						if(matches.length > index){
							args[key] = matches[index+1];
						}
					});
					_.each(path.methods, function(action, method){
						if(method == message.headers.method){
							action(message.body, args);
						}
					});
				}
			});
		}
		
		S.openConnection = _.throttle(function(){
			S.socket = Stomp.client('ws://' + settings.path).connect(settings.login, settings.password, function(){
				_.each(S.paths, function(path){
					S.socket.subscribe(path.originalPath, S.handleServerRequest);
				});
				if(typeof settings.onConnect === 'function'){
					settings.onConnect();
				}
				processRequestQueue();
			}, function(err){
				if(typeof settings.onConnectionError === 'function'){
					settings.onConnectionError(err);
				}
			});
			S.socket.debug = function(msg){
				if(msg.indexOf('Lost connection') > -1){
					S.ready = false;
					if(settings.autoReconnect){
						S.openConnection();
					}
					if(typeof settings.onClose === 'function'){
						settings.onClose(event);
					}
				}
			};
		}, 2000);
		
		// open the connection for the first time
		S.openConnection();
		
		// handle client requests to server
		S.requestQueue = [];
		function processRequestQueue(){
			_.each(S.requestQueue, function(sendObj){
				S.socket.send(sendObj.resource, sendObj.headers, sendObj.body);
			});
			S.requestQueue = [];
		}
		S.handleClientRequests = function(resource, method, data, notReady){
			
			// handle errors
			if(!resource || !method){
				return error('Requests require at least a resource and method.');
			}
			if(['PATCH', 'POST', 'PUT'].indexOf(method) > -1 && (!data || typeof data !== 'object')){
				return error(method + ' requests require a payload object.');
			}
			
			// set up the path
			var path = resource;
			if(method === 'GET'){
				var delim = '?';
				if(typeof params === 'object'){
					_.each(params, function(val, key){
						path += delim + key + '=' + val;
						delim = '&';
					});
				}
			}
			
			// set up request object
			var sendObj = {
				resource: path,
				headers: {
					method: method,
				},
				body: JSON.stringify(data)
			};
			
			if(S.ready){
				// make the request
				S.socket.send(sendObj.resource, sendObj.headers, sendObj.body);
			} else {
				// place requests in a queue to be executed when the connection is ready
				S.requestQueue.push(sendObj);
				if(typeof notReady === 'function'){
					notReady();
				}
			}
		};
	};
	
	_.extend(restSocket.prototype, {
		getPaths: function(){
			return this.paths;
		},
		getRawSTOMP: function(){
			return this.socket;
		},
		getReadyState: function(){
			return this.ready;
		},
		getRequestQueue: function(){
			return this.requestQueue;
		},
		get: function(resource, params, notReady){
			this.handleClientRequests(resource, 'GET', params, notReady);
		},
		patch: function(resource, payload, notReady){
			this.handleClientRequests(resource, 'PATCH', payload, notReady);
		},
		post: function(resource, payload, notReady){
			this.handleClientRequests(resource, 'POST', payload, notReady);
		},
		put: function(resource, payload, notReady){
			this.handleClientRequests(resource, 'PUT', payload, notReady);
		},
		remove: function(resource, notReady){
			this.handleClientRequests(resource, 'DELETE', notReady);
		},
		mirror: function(resource, method, data){
			this.handleServerRequest({
				headers: {
					subscription: resource,
					method: method
				},
				body: JSON.parse(data)
			});
		}
	});
	
	window.restSocket = restSocket;
	
}());
