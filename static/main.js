$(document).ready(function(){
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

  var socket;

  // Solves poor serializing
  function sendServer(socket, obj){
    socket.send(JSON.stringify(obj));
  }

  function connectServer() {
    var loc = location.hostname;
      socket = eio((location.protocol == "http:" ? "ws://" : "wss://") + loc, {
        upgrade: false,
        transports: ['polling']
      });
      socket.onopen = function(){
        socket.onmessage = function(data){
          var obj = JSON.parse(data);

          console.log(data);

          switch(obj.action) {
            case actions.IN_LOBBY:
              $("#wstart").addClass("hidden");
              $("#winterval").html("<h4>Waiting for other player...</h4>");
              $("#winterval").removeClass("hidden");
              break;
            case actions.GAME_START:
              if(!$("#wstart").hasClass("hidden"))
                $("#wstart").addClass("hidden");

              $("#winterval").addClass("hidden");
              $("#wgame").removeClass("hidden");
              $("#wscores").removeClass("hidden");
              break;
            case actions.RESULT:
              $("#wgame").addClass("hidden");
              var r = "";

              if(obj.value.drawn)
                r = "Drawn";
              else if(obj.value.won)
                r = "Won";
              else if(obj.value.lost)
                r = "Lost";
                
              $("#user-score").html(obj.value.scores.you);
              $("#other-score").html(obj.value.scores.opp);

              $("#winterval").html("<h4>You have " + r + "</h4>");
              $("#winterval").removeClass("hidden");
              $("#wagain").removeClass("hidden");
              break;
            case actions.DISCONNECT:
              $("#wgame").addClass("hidden");
              $("#wscores").addClass("hidden");
              $("#wagain").addClass("hidden");
              
              $("#user-score").html(0);
              $("#other-score").html(0);
              $("#winterval").html("<h4>Other user disconnected, fight abandoned!</h4>");
              
              $("#wstart").removeClass("hidden");
              $("#winterval").removeClass("hidden");
              break;
            case actions.MAX_USERS:
              $("#wgame").addClass("hidden");
              $("#wscores").addClass("hidden");
              $("#wagain").addClass("hidden");
              
              $("#winterval").html("<h4>Too many players connected!</h4>");
              
              $("#wstart").removeClass("hidden");
              $("#winterval").removeClass("hidden");
          }
        };
        socket.onclose = function(){
          socket = null;
          
          $("#wgame").addClass("hidden");
          $("#wscores").addClass("hidden");
          $("#wagain").addClass("hidden");
          
          $("#user-score").html(0);
          $("#other-score").html(0);
          $("#winterval").html("<h4>You've been disconnected...</h4>");
          
          $("#wstart").removeClass("hidden");
          $("#winterval").removeClass("hidden");
        };

        sendServer(socket, {
          action: actions.PLAY
        });
      };
  }

  $("#wstart button").click(function(){
      $("#winterval").html("Connecting...");
      $("#wstart").addClass("hidden");
      if(socket)
        sendServer(socket, {
          action: actions.PLAY
        });
      else
        connectServer();
  });
  
  $("#wagain button").click(function() {
    $("#wagain").addClass("hidden");
    $("#winterval").html("<h4>Requesting next duel...</h4>");
    sendServer(socket, {
      action: actions.PLAY_AGAIN
    });
  });

  $("#wselect button").click(function(){
    var val = $(this).data('val');

    if(socket)
      sendServer(socket, {value: val, action: actions.SELECT});
      
    $("#wgame").addClass("hidden");
    $("#winterval").html("<h4>Awaiting other user's weapon choice...</h4>");
    $("#winterval").removeClass("hidden");
  });
});