// Express
var express = require('express');
var app = express();

// HTTP server
var server = require('http').Server(app);
var io = require('socket.io')(server);

// Game code
var game = require('./game');
var util = require('util');

var port = process.env.OPENSHIFT_NODEJS_PORT || 3000;
var ip = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/static/index.html');
});

app.use(express.static('static'));

app.use(function (req, res, next) {
  res.status(404).send('Page does not exist');
});

game(io);

server.listen(port, ip);

console.log(util.format('Server started on %s:%s', ip, port));
