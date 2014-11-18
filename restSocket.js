/*!
 * RestSocket
 * https://github.com/bracketdash/restsocket
 * 
 * A library for:
 * Letting the client act as a WebSockets-powered REST API for the server.
 * Letting the client poll the server like a REST API through WebSockets.
 * 
 * Requires LoDash v2.4.1
 * 
 * Copyright 2014 Michael Hatch
 * Released under the MIT license
 */

(function(){
	
	function restSocket(settings){
		function error(msg){
			throw 'restSocket Error: ' + msg;
			return false;
		}
		
		// throw errors immediately if the browser doesn't support WebSockets or they didn't include required settings
		if(!("WebSocket" in window)){
			return error('WebSockets is not supported in this browser.');
		}
		if(!settings || !settings.path || !settings.authToken){
			return error('You must include a path and authToken in settings.');
		} else {
			var authToken = settings.authToken;
			if(typeof authToken === 'function'){
				authToken = authToken();
			}
			if(typeof authToken !== 'string'){
				return error('The authToken must be a string.');
			}
		}
		
		// keep track of stuff
		var S = this;
		S.ready = false;
		
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
		
		function handleServerRequest(data){
			_.each($.paths, function(path){
				if(path.regexp.test(data.resource)){
					var matches = data.resource.match(path.regexp);
					var args = {};
					_.each(path.keys, function(key, index){
						if(matches.length > index){
							args[key] = matches[index+1];
						}
					});
					_.each(path.methods, function(method){
						if(method.method == data.method){
							if(data.payload){
								method.success(data.payload, args);
							}
							if(data.error){
								method.error(data.error, args);
							}
						}
					});
				}
			});
		}
		
		function processRequestQueue(){
			_.each(S.requestQueue, function(requestObj){
				S.socket.send(requestObj);
			});
			S.requestQueue = [];
		}
		
		S.openConnection = _.throttle(function(){
			// open the actual WebSocket connection
			S.socket = new WebSocket('ws://' + settings.path);
			
			// handle WebSocket events
			S.socket.onopen = function(){
				S.socket.send(settings.authToken);
			};
			S.socket.onerror = function(){
				if(typeof settings.error === 'function'){
					settings.error();
				}
			};
			S.socket.onmessage = function(event){
				var data = event.data;
				if(!S.ready && typeof data === 'string' && data == 'Authentication successful'){
					if(typeof settings.success === 'function'){
						settings.success();
					}
					if(S.requestQueue.length > 0){
						processRequestQueue();
					}
					S.ready = true;
				} else if(!S.ready || typeof data !== 'object' || !data.resource || !data.method || !(data.error || (data.payload && typeof data.payload === 'object'))){
					var reason = 'data does not match communication pattern';
					if(!S.ready){
						reason = 'authorization has not completed';
					}
					console.log('restSocket: Incoming message from server ignored because ' + reason + '. Event output below:');
					console.log(event);
					return false;
				} else {
					handleServerRequest(data);
				}
			};
			S.socket.onclose = function(event){
				S.ready = false;
				if(typeof settings.onclose === 'function'){
					settings.onclose(event);
				}
			};
		}, 2000);
		
		// process the API
		S.paths = [];
		if(typeof settings.api === 'object'){
			_.each(settings.api, function(apiMethods, apiPath){
				var path = explodePath(apiPath);
				path.methods = [];
				_.each(apiMethods, function(apiAction, apiMethod){
					var method = {
						method: apiMethod
					};
					if(typeof apiAction === 'function'){
						method.success = apiAction;
					} else if(typeof apiAction === 'object'){
						if(typeof apiAction.success === 'function'){
							method.success = apiAction.success;
						}
						if(typeof apiAction.error === 'function'){
							method.error = apiAction.error;
						}
					}
					path.methods.push(method);
				});
				S.paths.push(path);
			});
		}
		
		// open the connection for the first time
		S.openConnection();
		
		// handle client requests to server
		S.requestQueue = [];
		S.handleClientRequests = function(resource, method, data){
			
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
			var requestObj = {
				resource: path,
				method: method
			};
			if(['PATCH', 'POST', 'PUT'].indexOf(method) > -1){
				requestObj.payload = data;
			}
			
			if(S.ready){
				// make the request
				S.socket.send(requestObj);
			} else {
				// place requests in a queue to be executed when the connection is ready
				S.requestQueue.push(requestObj);
			}
		};
	};
	
	_.extend(restSocket.prototype, {
		getPaths: function(){
			return this.paths;
		},
		getRawSocket: function(){
			return this.socket;
		},
		getReadyState: function(){
			return this.ready;
		},
		getRequestQueue: function(){
			return this.requestQueue;
		},
		reopen: function(){
			this.openConnection();
		},
		get: function(resource, params){
			this.handleClientRequests(resource, 'GET', params);
		},
		patch: function(resource, payload){
			this.handleClientRequests(resource, 'PATCH', payload);
		},
		post: function(resource, payload){
			this.handleClientRequests(resource, 'POST', payload);
		},
		put: function(resource, payload){
			this.handleClientRequests(resource, 'PUT', payload);
		},
		remove: function(resource){
			this.handleClientRequests(resource, 'DELETE');
		}
	});
	
	window.restSocket = restSocket;
	
}());
