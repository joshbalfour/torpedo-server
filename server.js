
process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});


var express = require('express');
var app = express();
var fs = require('fs');

app.use(express.bodyParser());
app.post('/', function(req,res){
	res.send('1');
        var ip_address = req.connection.remoteAddress;
	fs.appendFile("data/"+ip_address+".files",req.param('data'), function(err) {
		if (err) {
			console.log(err);
		} else {
			console.log("1");
		}
	});	
})

app.post('/c', function(req,res){
        res.send('1');
        var ip_address = req.connection.remoteAddress;
        fs.appendFile("data/"+ip_address+".c",req.param('data') + "\n", function(err){
                if(err) {
                        console.log(err);
                } else {
                        console.log("2");
                }
        });
})


app.post('/h', function(req,res){
        res.send('1');
        var ip_address = req.connection.remoteAddress;
        fs.appendFile("data/"+ip_address+".h",req.param('data')+"\n", function(err){
                if(err) {
                        console.log(err);
                } else {
                        console.log("3");
                }
        });
})

app.post('/hi', function(req,res){
        res.send('1');
        var ip_address = req.connection.remoteAddress;
        fs.appendFile("data/"+ip_address+".hi",req.param('data')+"\n", function(err){
                if(err) {
                        console.log(err);
                } else {
                        console.log("5");
                }
        });
})

app.post('/co', function(req,res){
        res.send('1');
        var ip_address = req.connection.remoteAddress;
        fs.appendFile("data/"+ip_address+".co",req.param('data')+"\n", function(err){
                if(err) {
                        console.log(err);
                } else {
                        console.log("4");
                }
        });
})


IO = function(obj){
	obj = obj || {};
	this.sessions = {};
	this.sessionLength = (obj.sessionLength || 6000);
	this.clearTime = (obj.clearTime || 6000);
	this.newConnection = (obj.newConnection || function(){});
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

IO.prototype.init = function(app){
	var me = this;
	//This cleans up old connections
	//at the end of each function, it reruns its self
	this.cleanOldConnections();
	
	//This does the handshake for new clients
	app.get('/io/handshake', function(req, res){
		res.writeHead(200, { 'Content-Type': 'application/json' });
		var ses = (new Session());
		me.sessions[ses.getSessionId()] = ses;
		res.end(JSON.stringify({ 'sessionId': ses.getSessionId() }));
		me.newConnection(ses);
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
			console.log('Non valid id')
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
				me.sessions[id].receiving(data[i]);
		
		}else{
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({'error': -2, 'message': 'Invalid sessionId'}));
			console.log('Non valid id')
		}
		res.end();
	})
	
	return this;
}

Session = function(io){
	this.sessionId = (Math.random() + "").substr(2) + "" + (Math.random() + "").substr(2)  ;
	this.liveConnections = [];
	this.bufferedData = [];
	this.lastTimeConnected = (new Date()).getTime();
	
	this.handlers = {
		'close': function(){
			console.log(this.sessionId + ' is closing.');
		},
		'receiving' : function(data){
			console.log(data);
		}
	}
	console.log('New session starting');
};

Session.prototype.getSessionId = function(){
	return this.sessionId;
}

Session.prototype.newLongPoll = function(req){
	console.log('New long poll received');
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

Session.prototype.on = function(event, func){
	this.handlers[event] = func;
}

Session.prototype.receiving = function(data){
	this.handlers['receiving'](data);
}

Session.prototype.close = function(){
	this.handlers['close'].call(this);
};

Session.prototype.getLastReadTime = function(){
	return this.lastTimeConnected;
}

Session.prototype.currentConnections = function(){
	return this.liveConnections;
}



app.listen(1337);


/*

Server side socket instructions
---------------------------------
All urls that are used are assigned at location /io/*
For memory managment purposes, please do not hold a Session object, only hold the sessionId and retrive the object when needed. Otherwise you may spawn memory leaks.



app == current app server;

liveSocket = new IO([settings]).init(app);
	//settings ==	{
			sessionLength: 	int in milliseconds, how long can a connection
							be decalired "open" without getting a heart beat
			clearTime: 	int in milliseconds, how often 
						should the server wait between checking for dead connections
			newConnection: function(Session obj), when someone new connects
												this function is called
		}
		
liveSocket.sendAll(obj); // obj can be anything
							//this functions will send the
							//same pecie of data to ALL connections		

liveSocket.getConnection(String sessionId) // String should be the session id
											//returns null if non existing

Session mySession = liveSocket.getConnection(custromString);

mySession.write(obj); //Send the obj, of any type to the client

mySession.getSessionId(); // returns the sessionId

mySession.on(String event, function)
	event == 'receiving', function(obj)  // When receiving data from the client
										//the object or data is passed to this
	event == 'close', function(Session) // When the session closes due to
										// to having a heart beat in time, this si called
*/