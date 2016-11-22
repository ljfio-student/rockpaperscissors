$(document).ready(function(){
  var weapons = {
    PAPER: 1,
    SCISSORS: 2,
    STONE: 3
  };

  var socket;

  function connectServer() {
    socket = io(location.origin);

    socket.on('connect',  function() {

      socket.on('in_lobby', function() {
        $('#wstart').addClass('hidden');
        $('#winterval').html('<h4>Waiting for other player...</h4>');
        $('#winterval').removeClass('hidden');
      });

      socket.on('game_start', function() {
        if(!$('#wstart').hasClass('hidden'))
          $('#wstart').addClass('hidden');

        $('#winterval').addClass('hidden');
        $('#wgame').removeClass('hidden');
        $('#wscores').removeClass('hidden');
      });

      socket.on('result', function(data) {
        $('#wgame').addClass('hidden');
        var r = '';

        if(data.drawn)
          r = 'Drawn';
        else if(data.won)
          r = 'Won';
        else if(data.lost)
          r = 'Lost';

        $('#user-score').html(data.scores.you);
        $('#other-score').html(data.scores.opp);

        $('#winterval').html('<h4>You have ' + r + '</h4>');
        $('#winterval').removeClass('hidden');
        $('#wagain').removeClass('hidden');
      });

      socket.on('abandon', function(data) {
        $('#wgame').addClass('hidden');
        $('#wscores').addClass('hidden');
        $('#wagain').addClass('hidden');

        $('#user-score').html(0);
        $('#other-score').html(0);
        $('#winterval').html('<h4>Other user disconnected, fight abandoned!</h4>');

        $('#wstart').removeClass('hidden');
        $('#winterval').removeClass('hidden');
      });

      socket.on('max_users', function() {
        $('#wgame').addClass('hidden');
        $('#wscores').addClass('hidden');
        $('#wagain').addClass('hidden');

        $('#winterval').html('<h4>Too many players connected!</h4>');

        $('#wstart').removeClass('hidden');
        $('#winterval').removeClass('hidden');
      });

      var not_connected = function() {
        $('#wgame').addClass('hidden');
        $('#wscores').addClass('hidden');
        $('#wagain').addClass('hidden');

        $('#user-score').html(0);
        $('#other-score').html(0);
        $('#winterval').html('<h4>You\'ve been disconnected...</h4>');

        $('#wstart').removeClass('hidden');
        $('#winterval').removeClass('hidden');
      }

      socket.on('disconnect', function() {

      });

      socket.on('reconnect', function() {

      });

      socket.on('reconnecting', function() {

      });

      socket.on('reconnect_failed', not_connected);
      socket.on('reconnect_error', not_connected);
      socket.on('error', not_connected);

      socket.emit('start');
    });
  }

  $('#wstart button').click(function(){
      $('#winterval').html('Connecting...');
      $('#wstart').addClass('hidden');

      if (socket) {
        socket.emit('start');
      } else {
        connectServer();
      }
  });

  $('#wagain button').click(function() {
    $('#wagain').addClass('hidden');
    $('#winterval').html('<h4>Requesting next duel...</h4>');

    socket.emit('play_again');
  });

  $('#wselect button').click(function(){
    var val = $(this).data('val');

    if (socket) {
      socket.emit('choice', { option: val });
    }

    $('#wgame').addClass('hidden');
    $('#winterval').html('<h4>Awaiting other user\'s weapon choice...</h4>');
    $('#winterval').removeClass('hidden');
  });
});
