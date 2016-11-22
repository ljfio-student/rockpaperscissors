var async = require('async');
var guid = require('guid');
var util = require('util');

var weapons = {
  PAPER: 1,
  SCISSORS: 2,
  STONE: 3
};

function Game(id, first, second) {
  this.id = id;
  var times = 0;
  var self = this;

  // Handle sockets joining a game
  first.join(this);
  second.join(this);

  server.to(id).emit('game_start');

  this.is_active = function() {
    return first.is_active() && second.is_active();
  };

  this.end = function() {
    if (first.is_active()) {
      first.leave(id);
    }

    if (second.is_active()) {
      second.leave(id);
    }
  };

  this.is_draw = function() {
    return first.get_choice() === second.get_choice();
  };

  this.is_one_winner = function() {
    var one = first.get_choice();
    var two = second.get_choice();

    return (one == weapons.SCISSORS && two == weapons.PAPER) ||
      (one == weapons.STONE && two == weapons.SCISSORS) ||
      (one == weapons.PAPER && two == weapons.STONE);
  }

  this.check = function() {
    if (first.get_choice() !== null && second.get_choice() !== null) {
      times++;

      var first_score = first.get_score();
      var second_score = second.get_score();

      if (self.is_draw()) {
        first.draw();
        second.draw();
      } else if (self.is_one_winner()) {
        first.win();
        second.lose();
      } else {
        first.lose();
        second.win();
      }
    }
  }

  this.get_scores = function(player) {
    if (player == first) {
      return {
        you: first.get_score(),
        opp: second.get_score()
      };
    } else if (player == second) {
      return {
        you: second.get_score(),
        opp: first.get_score()
      };
    } else {
      return {
        first: first.get_score(),
        second: second.get_score()
      }
    }
  }

  this.reset = function() {
    if(first.get_choice() === null && second.get_choice() === null) {
      server.to(id).emit('game_start');
    }
  }
};

function Player(socket) {
  var active = true;
  var game = null;
  var choice = null;
  var score = 0;

  var self = this;

  socket.on('disconnect', function() {
    active = false;

    if (game !== null) {
      game.end();
    }
  });

  socket.on('start', function() {
    waiting.push(self);
    socket.join('waiting');

    socket.emit('in_lobby');
  });

  // TODO: Handle usernames?

  // TODO: Handle chat messages?

  socket.on('choice', function(data) {
    choice = data.option;

    game.check();
  });

  socket.on('play_again', function() {
    choice = null;

    game.reset();
  })

  this.join = function(new_game) {
    game = new_game;

    socket.leave('waiting');
    socket.join(game.id);
  };

  this.is_active = function() {
    return active;
  };

  this.leave = function(id) {
    socket.emit('abandon');

    socket.leave(id);
    socket.join('waiting');

    game = null;
  }

  this.get_choice = function() {
    return choice;
  }

  this.get_score = function() {
    return score;
  }

  this.draw = function() {
    socket.emit('result', {
      drawn: true,
      scores: game.get_scores(this)
    });
  }

  this.win = function() {
    score++;

    socket.emit('result', {
      won: true,
      scores: game.get_scores(this)
    });
  }

  this.lose = function() {
    socket.emit('result', {
      lost: true,
      scores: game.get_scores(this)
    });
  }
}

var games = []; // In a game
var players = []; // Not wanting to play
var waiting = []; // Waiting to join a game

var server = null;

async.forever(function(callback) {
  if (waiting.length > 1) {
    var id = guid.create();

    var first = waiting.pop();
    var second = waiting.pop();

    var game = new Game(id, first, second);

    games.push(game);
  }

  setTimeout(callback, 1000);
});

var clear_games = function(game, callback) {
  var is_active = game.is_active();

  if (!is_active) {
    game.end();

    var scores = game.get_scores();

    console.log(util.format('game: %s - score: %s vs %s', game.id, scores.first, scores.second));
  }

  callback(null, !is_active);
};

async.forever(function(callback) {
  async.filter(games, clear_games, function(err, results) {
    if (!err) {
      for (var r in results) {
        games.splice(games.indexOf(results[r]), 1);
      }
    }
  });

  setTimeout(callback, 5000);
});

module.exports = function(io) {
  io.on('connection', function(socket) {
    var player = new Player(socket);

    players.push(player);
  });

  server = io;

  console.log('Game bound');
};
