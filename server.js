
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});


var express = require('express');
var app = express();
var fs = require('fs');

app.use(express.bodyParser());


IO = function(obj){
	obj = obj || {};
	this.sessions = {};
	this.sessionLength = (obj.sessionLength || 600000);
	this.clearTime = (obj.clearTime || 60000);
	this.ipLock = (obj.ipLock || false);
	
	this.sessionHandlers = {};
};

IO.prototype.cleanOldConnections = function(){
	currentTime = (new Date()).getTime();
	for(var i in this.sessions){
		if(this.sessions[i].getLastReadTime() +  this.sessionLength < currentTime || this.sessions[i].currentConnections() > 0 ){
			this.sessions[i].close();
			delete this.sessions[i];
		}
	}
	var me = this;
	setTimeout(function(){
		me.cleanOldConnections();
	}, this.clearTime);
};

IO.prototype.getDefaultHandlers = function(){
	return this.sessionHandlers;
}

IO.prototype.sendAll = function(data){
	for(var i in this.sessions)
		this.sessions[i].write(data);
}

IO.prototype.getConnection = function(id){
	if(this.sessions[id] != undefined)
		return this.sessions[id]
	else
		return null;
}

IO.prototype.on = function(event, func){
	this.sessionHandlers[event] = func;
		
}

IO.prototype.init = function(app){
	var me = this;
	//This cleans up old connections
	//at the end of each function, it reruns its self
	this.cleanOldConnections();
	
	//This does the handshake for new clients
	app.get('/io/handshake', function(req, res){
		res.writeHead(200, { 'Content-Type': 'application/json' });
		var ses = (new Session({ 'server': me, 'req': req}));
		me.sessions[ses.getSessionId()] = ses;
		res.end(JSON.stringify({ 'sessionId': ses.getSessionId() }));
		ses.getHandler('new').call(ses)
	})
	
	//this sends data to the client
	//this is the "Long Poll"
	// Server -> data -> client
	app.post('/io/read', function(req, res){
		console.log(' New long poll ' + req.connection.remoteAddress);
		var id = req.body.sessionId;
		if(me.sessions[id] != undefined)
			me.sessions[id].newLongPoll(res);
		else{
			console.log('Non valid id');
			socket.end({'error': -2, 'message': 'Invalid sessionId'});
		}
	})
	
	//this receivces data
	// Client -> data -> server
	app.post('/io/write', function(req, res){
		console.log('Reading new data ' + req.connection.remoteAddress);
		var id = req.body.sessionId;
		if(me.sessions[id] != undefined){
			var data = JSON.parse(req.body.data);
			for(var i in data)
				me.sessions[id].receiving(data[i],req);
		
		}else{
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({'error': -2, 'message': 'Invalid sessionId'}));
			console.log('Non valid id')
		}
		res.end();
	})
	
	return this;
}



Session = function(data){
	this.sessionId = (Math.random() + "").substr(2) + "" + (Math.random() + "").substr(2)  ;
	this.liveConnections = [];
	this.bufferedData = [];
	this.lastTimeConnected = (new Date()).getTime();
	this.ipLock = data.server.ipLock;
	this.ipAddress = data.req.connection.remoteAddress
	
	this.defaultHandlers = data.server.getDefaultHandlers();
	this.localHandlers = {};
	
	console.log('New session starting');
};

Session.prototype.getIpAddress = function(){
	return this.ipAddress;
}

Session.prototype.getSessionId = function(){
	return this.sessionId;
}

Session.prototype.newLongPoll = function(req){
	console.log('New long poll received');
	if(req.connection.remoteAddress !=this.ipAddress)
		return;
	this.liveConnections.push(req);
	this.lastTimeConnected = (new Date()).getTime();
	var connections = this.liveConnections;
	this.sendBufferedData();
}

Session.prototype.write = function(data){
	console.log('Adding data to write buffer');
	this.bufferedData.push(data);
	this.sendBufferedData();
}

Session.prototype.sendBufferedData = function(){
	console.log('Checking for buffered data to send')
	if( false == (this.liveConnections.length > 0 && this.bufferedData.length > 0) )
		return;
	 console.log('getting connection')
	var socket = this.liveConnections.pop();
	if(socket == undefined)
	return;
	
	console.log('Get buffered data ' + this.bufferedData.length)
	var buffer = [];
	var lastData = undefined;
	while(true){
		lastData = this.bufferedData.pop();
		if(lastData == undefined)
			break;
		buffer.push(lastData);
	};
	console.log('data is being sent');
	if( buffer.length == 0 ){
		this.liveConnections.push(socket);
	}else{
	 	socket.writeHead(200, { 'Content-Type': 'application/json' });
		socket.end(JSON.stringify({"data": buffer}));
	 }
}

Session.prototype.getHandler = function(event){
	if(typeof this.localHandlers[event] == 'function')
		return this.localHandlers[event];
	else if(typeof this.defaultHandlers[event] == 'function')
		return this.defaultHandlers[event];
	else
		return function(){};
}

Session.prototype.on = function(event, func){
	this.localHandlers[event] = func;
}

Session.prototype.receiving = function(data,req){
	if(req.connection.remoteAddress != this.ipAddress)
		return;
	this.getHandler('receiving').call(this,data);
}

Session.prototype.close = function(){
	this.getHandler('close').call(this);
};

Session.prototype.getLastReadTime = function(){
	return this.lastTimeConnected;
}

Session.prototype.currentConnections = function(){
	return this.liveConnections;
}


/*

Server side socket instructions
---------------------------------
All urls that are used are assigned at location /io/*
For memory managment purposes, please do not hold a Session object, only hold the sessionId and retrive the object when needed. Otherwise you may spawn memory leaks.



app == current app server;

liveSocket = new IO([settings]).init(app);
	//settings ==	{
			ipLock: //is a session locked to an ip, default false;
			sessionLength: 	int in milliseconds, how long can a connection
							be decalired "open" without getting a heart beat
			clearTime: 	int in milliseconds, how often 
						should the server wait between checking for dead connections
		}
		
liveSocket.sendAll(obj); // obj can be anything
							//this functions will send the
							//same pecie of data to ALL connections		

liveSocket.getConnection(String sessionId) // String should be the session id
											//returns null if non existing

											
liveSocket.on('closing'/'receiving'/'new', function(){ this == Session })
											//this function sets the default handlers for each socket
											
Session mySession = liveSocket.getConnection(customString);

mySession.write(obj); //Send the obj, of any type to the client

mySession.getSessionId(); // returns the sessionId

mySession.getIpAddress(); //returns ip address

mySession.on(String event, function)
	event == 'receiving', function(obj)  // When receiving data from the client
										//the object or data is passed to this
	event == 'close', function(Session) // When the session closes due to
										// to having a heart beat in time, this si called
*/

app.listen(1337);

var socket = new IO().init(app);
app.get('/test', function(req, res){
		socket.sendAll([5,"ls"]);
		res.end("1");
	});
	
/* Next: handle the data being recieved */

socket.on('receiving',function(data){
	console.log(data);
	fs.appendFile("data/"+this.getSessionId()+"."+data[0],data[1] + "\n", function(err){
                if(err) {
                        console.log(err);
                } else {
                        console.log(data[0]);
                }
        }); 
});