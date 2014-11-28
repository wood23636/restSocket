/*!
 * RestSocket v0.3.0
 * https://github.com/bracketdash/restSocket
 * 
 * Requires STOMP v2.3.4 and LoDash v2.4.1
 * 
 * Copyright 2014 Michael Hatch
 * Released under the MIT license
 */

(function(){
	
	function keysFromPath(path) {
		var re = /\[("|')(.+)\1\]|([^.\[\]]+)/g;
		var elements = [];
		var result;
		while ((result = re.exec(path)) !== null) {
			elements.push(result[2] || result[3]);
		}
		return elements;
	}
	
	function getPath(obj, ks){
		if(typeof ks === 'string'){
			ks = keysFromPath(ks);
		}
		var i = -1;
		var length = ks.length;
		while(++i < length && obj != null){
			obj = obj[ks[i]];
		}
		return i === length ? obj : void 0;
	}
	
	function restSocket(settings){
		function error(msg){
			throw 'restSocket Error: ' + msg;
			return false;
		}
		
		if(!("WebSocket" in window)){
			return error('WebSockets is not supported in this browser.');
		}
		if(typeof settings !== 'object' || typeof settings.path !== 'string' || typeof settings.login !== 'string' || typeof settings.password !== 'string'){
			return error('restSocket requires a settings object with at least a path, login, and password.');
		}
		
		var S = this;
		S.ready = false;
		
		S.openConnection = _.throttle(function(){
			S.socket = Stomp.client('ws://' + settings.path).connect(settings.login, settings.password, function(){
				if(typeof settings.onConnect === 'function'){
					settings.onConnect();
				}
				processRequestQueue();
				resubscribeToExistingSubscriptions();
			}, function(err){
				if(typeof settings.onConnectionError === 'function'){
					settings.onConnectionError(err);
				}
			});
			S.socket.debug = function(msg){
				if(msg.indexOf('Lost connection') > -1){
					S.ready = false;
					if(typeof settings.autoReconnect === 'undefined' || settings.autoReconnect){
						S.openConnection();
					}
					if(typeof settings.onClose === 'function'){
						settings.onClose(event);
					}
				}
			};
		}, 2000);
		S.openConnection();
		
		function subscriptionRouter(message){
			
			// try to parse the body
			var body = null;
			try {
				body = JSON.parse(message.body);
			} finally {}
			
			// try to get a method
			var method = null;
			if(_.isString(message.headers.method) && message.headers.method.length){
				method = message.headers.method.toUpperCase();
			}
			
			// get the destination data
			var splitDestination = message.headers.destination.split('/');
			var jsonPath = [];
			_.each(splitDestination, function(destinationPart){
				var parsedPart = parseInt(destinationPart);
				if(!isNaN(parsedPart) && parsedPart.toString() === destinationPart){
					jsonPath.push(parsedPart);
				} else {
					jsonPath.push("'" + destinationPart + "'");
				}
			});
			var jsonPathParent = '[' + jsonPath.slice(0,-1).join('][') + ']';
			var jsonPathLastPart = jsonPath.slice(-1);
			jsonPath = '[' + jsonPath.join('][') + ']';
			var destinationData = getPath(settings.model, jsonPath);
			var destinationParentData = getPath(settings.model, jsonPathParent);
			
			// deal with scenarios when the destination data does not exist
			if(!destinationData){
				
				// check if we should be adding a new item to a collection in response to a PUT
				if(!destinationParentData){
					return;
				}
				if(body && _.isString(message.headers.method) && message.headers.method.length){
					var method = message.headers.method.toUpperCase();
					if(_.isArray(destinationParentData) && method === 'PUT'){
						// PUT item (that doesn't yet exist)
						destinationParentData.push(body);
					}
				}
				return;
			}
			
			// appropriately route the message
			if(method){
				if(body){
					if(method === 'DELETE'){
						// redirect
						message.body = '';
						processSubscription(message);
					} else if(method === 'POST' || method === 'PATCH'){
						// redirect
						message.headers.method = '';
						processSubscription(message);
					} else if(method === 'PUT'){
						if(_.isArray(destinationData) && _.isArray(body)){
							// PUT collection
							destinationData = body;
						} else if(_.isPlainObject(destinationData) && _.isPlainObject(body)){
							// PUT item
							destinationData = body;
						}
					}
				} else if(method === 'DELETE' && _.isPlainObject(destinationData)){
					// DELETE item
					destinationParentData.splice(jsonPathLastPart, 1);
				}
			} else if(body){
				if(_.isArray(destinationData)){
					if(_.isArray(body)){
						// PATCH collection
						// TODO: Patch the collection at the destination with the body collection, then send an ACK frame.
					} else if(_.isPlainObject(body)){
						// POST item
						destinationData.push(body);
					}
				} else if(_.isPlainObject(destinationData)){
					if(_.isPlainObject(body)){
						// PATCH item
						// TODO: Patch the object at the destination with the body object, then send an ACK frame.
					}
				}
			}
		};
		
		S.subscriptions = [];
		function resubscribeToExistingSubscriptions(){
			_.each(S.subscriptions, function(subscription){
				S.handleClientSubscribes(subscription.destination, subscription.callback, subscription.headers);
			});
		}
		S.handleClientSubscribes = function(destination, overrideCallback, headers){
			var subscriptionHeaders = {};
			if(_.isPlainObject(additionalHeaders)){
				subscriptionHeaders = headers;
			} else if(_.isPlainObject(callback)){
				subscriptionHeaders = callback;
			}
			var onmessage = function(message){
				var callback = subscriptionRouter;
				if(_.isFunction(overrideCallback)){
					callback = overrideCallback;
				}
				callback(message);
			};
			var subscriptionReference = S.socket.subscribe(destination, onmessage, subscriptionHeaders);
			var uid = _.uniqueId();
			S.subscriptions.push({
				uid: uid,
				destination: destination,
				overrideCallback: onmessage,
				headers: subscriptionHeaders
			});
			var modifiedSubscriptionReference = function(){
				this.uid = uid;
			};
			modifiedSubscriptionReference.prototype.unsubscribe = function(){
				S.subscriptions.splice(_.indexOf(S.subscriptions, _.findWhere(S.subscriptions, {uid:this.uid})), 1);
				subscriptionReference.unsubscribe();
			};
			return modifiedSubscriptionReference;
		};
		
		S.requestQueue = [];
		function processRequestQueue(){
			_.each(S.requestQueue, function(sendObj){
				S.socket.send(sendObj.resource, sendObj.headers, sendObj.body);
			});
			S.requestQueue = [];
		}
		S.handleClientRequests = function(destination, method, body, additionalHeaders, notReadyCallback){
			if(!destination || !method){
				return error('Messages require at least a destination and method.');
			}
			var sendObj = {
				destination: destination,
				headers: {
					method: method,
				}
			};
			if(_.isPlainObject(body)){
				sendObj.body = JSON.stringify(body); 
			}
			if(_.isPlainObject(additionalHeaders)){
				_.assign(sendObj.headers, additionalHeaders);
			}
			if(S.ready){
				S.socket.send(sendObj.resource, sendObj.headers, sendObj.body);
			} else {
				S.requestQueue.push(sendObj);
				if(_.isFunction(notReadyCallback)){
					notReadyCallback();
				} else if(_.isFunction(additionalHeaders)){
					additionalHeaders();
				} else if(_.isFunction(body)){
					body();
				}
			}
		};
	};
	
	_.extend(restSocket.prototype, {
		send: function(destination, method, additionalHeaders, body, notReadyCallback){
			this.handleClientRequests(destination, method, body, additionalHeaders, notReadyCallback);
		},
		subscribe: function(destination, callback, headers){
			this.handleClientSubscribes(destination, callback, headers);
		},
		get: function(destination, additionalHeaders, callback, subscriptionHeaders){
			this.handleClientRequests(destination, 'GET', {}, additionalHeaders);
			var mySubscription = this.handleClientSubscribes(destination, function(message){
				if(message.headers.method !== 'PUT'){
					return false;
				}
				var data = JSON.parse(message.body);
				callback(data);
				mySubscription.unsubscribe();
			}, subscriptionHeaders);
		},
		mirror: function(destination, method, data){
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
