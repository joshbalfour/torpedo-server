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

app.get('*', function(req,res){

	res.send('');
})

app.listen(1337);
