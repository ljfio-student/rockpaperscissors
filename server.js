// HTTP Server
var fs = require('fs');
var mo = require('./mo');
var http = require("http");
var url = require('url');
var engine = require('engine.io')
var async = require("async");

// Calculate size of an object
Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

// Web server
var httpServer = http.createServer(function(req, res){
  var uri = url.parse(req.url, true);
  var data = "";

  var files = [
    {path: "/", render: "static/index.html", type:"text/html"},
    {path: "/engine.io.js", file: "static/engine.io.js", type: "text/javascript"},
    {path: "/main.js", file: "static/main.js", type: "text/javascript"},
    
    {path: "/img/scissors.gif", file: "static/350x350.gif", type:"image/gif"},
    {path: "/img/paper.gif", file: "static/350x350.gif", type:"image/gif"},
    {path: "/img/stone.gif", file: "static/350x350.gif", type:"image/gif"}
  ];

  // Get the data being sent to us
  req.addListener("data", function(chunk){
    data += chunk;
  });

  req.addListener("end", function(){
    var args = {
      type: "",
      status: 500,
      content: "",
      set: false
    };

    for(var i = 0; i < files.length; i++) {
      if(files[i].path == uri.pathname) {
        var a = {
          port: process.env.PORT
        };

        args.type = files[i].type;
        if(files[i].render)
          args.content = mo.render(fs.readFileSync(files[i].render, 'utf8'), a);
        else
          args.content = fs.readFileSync(files[i].file);
        
        args.status = 200;
        args.set = true;

        break;
      }
    }

    // If doesn't exist
    if(!args.set) {
      args.type = "text/plain";
      args.content = "Page does not exist";
      args.status = 404;
    }

    // Send response
    res.writeHead(args.status, { 'Content-Type': args.type});
    res.write(args.content);
    res.end();
  });
}).listen(process.env.OPENSHIFT_NODEJS_PORT, process.env.OPENSHIFT_NODEJS_IP);

// Game server
var games = [];
var games_count = 0;
var lobby = [];

// Async updates
var updates_in = [];
var updates_out = [];

// Users
var users = [];
var user_space = [];
var user_games = 50;
var user_count = 0;
var user_limit = user_games * 2;

// Actions
var actions = {
  PLAY: 0,
  SELECT: 1,
  MAX_USERS: 2,
  RESULT: 3,
  GAME_START: 4,
  IN_LOBBY: 5,
  PLAY_AGAIN: 6,
  DISCONNECT: 7
};
var weapons = {
  PAPER: 1,
  SCISSORS: 2,
  STONE: 3
};

// Solves poor serializing
function sendClient(socket, obj){
  socket.send(JSON.stringify(obj));
}

// Game check winner
function checkWinner(one, two) {
  if(one == two) {
    return 0;
  } else if((one == weapons.SCISSORS && two == weapons.PAPER) || (one == weapons.STONE && two == weapons.SCISSORS) || (one == weapons.PAPER && two == weapons.STONE)) {
    return 1;
  } else {
    return 2;
  }
}

// Initialise the server
var server = engine.attach(httpServer);
server.on('connection', function (socket) {
  socket.id = -1;

  socket.on('message', function (data) {
    if(typeof(data) == "string") {
      var obj = JSON.parse(data);

      updates_in.push({
        id: socket.id,
        action: obj.action,
        value: obj.value
      });
    }
  });

  socket.on('close', function () {
    socket.id = -2;
  });

  if(user_space.length > 0) {
    socket.id = user_space.pop();
  } else if(users.length >= user_limit) {
    sendClient(socket, {
      action: actions.MAX_USERS
    });
    socket.close();
  } else {
    socket.id = user_count;
    user_count++;
  }
  
  if(socket.id >= 0) {
    users.push(socket);
  }
  
  socket.old_id = socket.id;
});

// Check for updates
async.forever(function(callback){
  while(updates_in.length > 0) {
    var u = updates_in.pop();

    switch(u.action) {
      case actions.PLAY:
        if(lobby.length > 0) {
          var opp = lobby.pop();

          games.push({
            id: games_count,
            one: opp,
            two: u.id,
            s_one: 0, // Scores
            s_two: 0,
            c_one: 0, // Choices
            c_two: 0,
            r_one: false, // Ready to play
            r_two: false,
            times: 0
          });
          games_count++;
          
          updates_out.push({
            to: [opp, u.id],
            action: actions.GAME_START
          });
        } else {
          lobby.push(u.id);
          updates_out.push({
            to: u.id,
            action: actions.IN_LOBBY
          });
        }
        break;
      case actions.SELECT:
        for(var g in games){
          if(u.value > 0 && u.value < (Object.size(weapons) + 1)) {
            if(games[g].one == u.id){
              games[g].c_one = u.value;
            } else if(games[g].two == u.id) {
              games[g].c_two = u.value;
            }

            // Time to compare choices
            if(games[g].c_one !== 0 && games[g].c_two !== 0) {
              var r = checkWinner(games[g].c_one, games[g].c_two);

              // Reset and update stats
              if(r == 1){
                games[g].s_one++;
              } else if(r == 2) {
                games[g].s_two++;
              }

              games[g].c_one = 0;
              games[g].c_two = 0;
              games[g].times++;

              // Push result to clients
              updates_out.push({
                to: games[g].one,
                action: actions.RESULT,
                value:{
                  won: r == 1,
                  drawn: r === 0,
                  lost: r == 2,
                  scores: {
                    you: games[g].s_one,
                    opp: games[g].s_two
                  }
                }
              });
              updates_out.push({
                to: games[g].two,
                action: actions.RESULT,
                value: {
                  won: r == 2,
                  drawn: r === 0,
                  lost: r == 1,
                  scores: {
                    you: games[g].s_two,
                    opp: games[g].s_one
                  }
                }
              });
            }
            
            console.log("game: " + JSON.stringify(games[g]));
          } else {
            // Invalid choice
            break;
          }
        }
        break;
      case actions.PLAY_AGAIN:
        for(var g in games){
          var game_up = false;
          
          if(games[g].one == u.id) {
            games[g].r_one = true;
            game_up = true;
          } else if(games[g].two == u.id) {
            games[g].r_two = true;
            game_up = true;
          }
          
          if(game_up) {
            if(games[g].r_one && games[g].r_two) {
              updates_out.push({
                to: [games[g].one, games[g].two],
                action: actions.GAME_START
              });
              
              // Reset ready state
              games[g].r_one = false;
              games[g].r_two = false;
            } else {
              updates_out.push({
                to: u.id,
                action: actions.IN_LOBBY
              });
            }
          }
        }
    }

    console.log("in: " + JSON.stringify(u));
  }

  setTimeout(callback, 100);
}, function(err){
  console.log("in-err:" + err);
});

// This sends data out to client
async.forever(function(callback){
  while(updates_out.length > 0){
    var u = updates_out.pop();
    var to = [];
    var sent = 0;

    // Make into an array
    if(typeof u.to == "number")
      to.push(u.to)
    else if(u.to instanceof Array)
      to = u.to;

    // Loop through the 'to' list
    for(var x in to) {
      var t = to[x];

      for(var a in users) {
        if(users[a].id == t) {
          sendClient(users[a], {
            action: u.action,
            value: u.value
          });
          sent++;

          break;
        }
      }
    }

    console.log("out: " + JSON.stringify(u) + " - Sent: " + (sent == to.length ? "true" : "false"));
  }

  setTimeout(callback, 100);
}, function(err){
  console.log("out-err:" + err);
});

// This checks for dead connections
async.forever(function(callback){
  for(var x in users) {
    if(users[x].id == -2) {
      for(var g in games){
        var user_disconnect = false;
        
        if(games[g].one == users[x].old_id) {
          updates_out.push({
            to: games[g].two,
            action: actions.DISCONNECT
          });
          user_disconnect = true;
        } else if(games[g].two == users[x].old_id) {
          updates_out.push({
            to: games[g].one,
            action: actions.DISCONNECT
          });
          user_disconnect = true;
        }
        
        if(user_disconnect) {
          if(!fs.exists('games.csv')) {
            fs.writeFileSync('games.csv', "id,one,two,times\n");
          }
          
          fs.appendFileSync('games.csv',
            games[g].id + "," +
            games[g].s_one + "," +
            games[g].s_two + "," +
            games[g].times + '\n'
          );
          
          games.splice(g, 1);
        }
      }
      
      for(var l in lobby) {
        if(users[x].old_id == lobby[l]) {
          lobby.splice(l, 1);
        }
      }
      
      user_space.push(users[x].old_id);
      users.splice(x, 1);
    }
  }

  setTimeout(callback, 100);
}, function(err){
  console.log("dead-err:" + err);
});
