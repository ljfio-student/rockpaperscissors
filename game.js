var async = require('async');
var guid = require('guid');
var util = require('util');

var weapons = {
  PAPER: 1,
  SCISSORS: 2,
  STONE: 3
};

class Game {
  constructor(id, first, second) {
    this.id = id;

    this._times = 0;

    this._first = first;
    this._second = second;

    // Handle sockets joining a game
    first.join(this);
    second.join(this);

    server.to(id).emit('game_start');
  }

  get active() {
    return this._first.active && this._second.active;
  }

  end() {
    if (this._first.active) {
      this._first.leave(this.id);
    }

    if (this._second.active) {
      this._second.leave(this.id);
    }
  }

  is_draw() {
    return this._first.choice === this._second.choice;
  }

  is_one_winner() {
    var one = this._first.choice;
    var two = this._second.choice;

    return (one == weapons.SCISSORS && two == weapons.PAPER) ||
      (one == weapons.STONE && two == weapons.SCISSORS) ||
      (one == weapons.PAPER && two == weapons.STONE);
  }

  check() {
    if (this._first.choice !== null && this._second.choice !== null) {
      this._times++;

      var first_score = this._first.score;
      var second_score = this._second.score;

      if (this.is_draw()) {
        this._first.draw();
        this._second.draw();
      } else if (this.is_one_winner()) {
        this._first.win();
        this._second.lose();
      } else {
        this._first.lose();
        this._second.win();
      }
    }
  }

  scores_for(player) {
    if (player == this._first) {
      return {
        you: this._first.score,
        opp: this._second.score
      };
    } else if (player == this._second) {
      return {
        you: this._second.score,
        opp: this._first.score
      };
    }
  }

  get scores() {
    return {
      first: this._first.score,
      second: this._second.score
    }
  }

  reset() {
    if(this._first.choice === null && this._second.choice === null) {
      server.to(this.id).emit('game_start');
    }
  }
}

class Player {
  constructor(socket) {
    this._socket = socket;

    this._active = true;

    this._game = null;
    this._choice = null;

    this._score = 0;

    socket.on('disconnect', () => this._disconnect());
    socket.on('choice', (data) => this._make_choice(data));
    socket.on('start', () => this._start());
    socket.on('play_again', () => this._play_again());
  }

  _disconnect() {
    this._active = false;

    if (this._game !== null) {
      this._game.end();
    }
  }

  _start() {
    waiting.push(this);

    this._socket.join('waiting');

    this._socket.emit('in_lobby');
  }

  // TODO: Handle usernames?

  // TODO: Handle chat messages?

  _make_choice(data) {
    this._choice = data.option;

    this._game.check();
  }

  _play_again() {
    this._choice = null;

    this._game.reset();
  }

  join(new_game) {
    this._game = new_game;

    this._socket.leave('waiting');
    this._socket.join(this._game.id);
  }

  leave(id) {
    this._socket.emit('abandon');

    this._socket.leave(id);
    this._socket.join('waiting');

    this._game = null;
    this._choice = null;
  }

  get active() { return this._active; }

  get choice() { return this._choice; }

  get score() { return this._score; }

  draw() {
    this._socket.emit('result', {
      drawn: true,
      scores: this._game.scores_for(this)
    });
  }

  win() {
    this._score++;

    this._socket.emit('result', {
      won: true,
      scores: this._game.scores_for(this)
    });
  }

  lose() {
    this._socket.emit('result', {
      lost: true,
      scores: this._game.scores_for(this)
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
  var is_active = game.active;

  if (!is_active) {
    game.end();

    console.log(util.format('game: %s - score: %s vs %s', game.id, game.scores.first, game.scores.second));
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

    // players.push(player);
  });

  server = io;

  console.log('Game bound');
};
