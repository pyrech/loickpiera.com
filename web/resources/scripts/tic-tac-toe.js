
/*
  LICENCE blablabla todo

 */

var ticTacToe = function(squares, opts) {
  this.size = 3;
  if (!squares || squares.length != this.size*this.size) {
    throw 'Invalid squares given (null or lenght diffent of '+(this.size*this.size)+')! Can\'t launch the game';
  };
  if (!Function.prototype.bind) {
    throw 'Invalid configuration!';
  };
  this.squares = squares;
  this.board = [];
  this.winning_rows = [];
  this.game = 0;

  this.opts = opts || {};

  this.nobody = 0;
  this.player = 1;
  this.computer = this.size+1;

  this.turn = null;
  this.winner = null;

  this.names = {};
  this.names[this.player] = 'Player';
  this.names[this.computer] = 'Computer';

  this.symbols = {};
  this.symbols[this.player] = 'o';
  this.symbols[this.computer] = 'x';

  this.initialize();
  if ('onInit' in this.opts) {
    this.opts.onInit();
  }
};
ticTacToe.prototype.addEvent = function (obj, type, fn) {
  if (obj.addEventListener) {
    obj.addEventListener(type, fn, false);
  }
  else if (obj.attachEvent) {
    // IE
    obj.attachEvent("on" + type, fn);
  }
};
ticTacToe.prototype.shuffle = function (array) {
    var counter = array.length, temp, index;
    // While there are elements in the array
    while (counter--) {
        // Pick a random index
        index = (Math.random() * (counter + 1)) | 0;
        // And swap the last element with it
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
    }

    return array;
}
ticTacToe.prototype.shuffleWinningRows = function() {
  this.winning_rows = this.shuffle(this.winning_rows);
}
ticTacToe.prototype.prepareGame = function() {
  this.game++;
  this.turn = this.game % 2 ? this.player : this.computer;
  this.winner = this.nobody;
  for (var i=0; i<this.size; i++) {
    for (var j=0; j<this.size; j++) {
      var index = i*this.size + j;
      this.board[index] = this.nobody;
      var square = this.squares[index];
      square.innerHTML = '';
      square.style.cursor = 'pointer';
    }
  }
  if (this.turn == this.computer) {
    this.playComputer();
  }
}
ticTacToe.prototype.onResize = function() {
  for (var i=0; i<this.squares.length; i++) {
    var square = this.squares[i];
    var height = square.offsetHeight;
    square.style.fontSize = (height*0.8)+'px';
    square.style.lineHeight = (height*0.95)+'px';
  }
}
ticTacToe.prototype.initialize = function() {
  var diagonal1 = [];
  var diagonal2 = [];

  for (var i=0; i<this.size; i++) {
    var row = [];
    var column = [];
    for (var j=0; j<this.size; j++) {
      var index = i*this.size + j;

      // winning rows
      row.push(index);
      column.push(i + j*this.size);
      if (i == j) {
        diagonal1.push(index);
      }
      if ((this.size-i-1) == j) {
        diagonal2.push(index);
      }

      // html elt
      var square = this.squares[index];
      this.addEvent(square, 'click', this.play.bind(this, this.player, index));

      // styles
      square.style.textAlign = 'center';
      square.style.backgroundColor = '#ffffff';
      square.style.borderColor = '#5B5B5B';
      square.style.borderStyle = 'solid';
      square.style.borderTopWidth = (i == 0 ? '2px' : '1px');
      square.style.borderBottomWidth = (i == (this.size-1) ? '2px' : '1px');
      square.style.borderLeftWidth = (j == 0 ? '2px' : '1px');
      square.style.borderRightWidth = (j == (this.size-1) ? '2px' : '1px');
    }
    this.winning_rows.push(row);
    this.winning_rows.push(column);
  }
  this.winning_rows.push(diagonal1);
  this.winning_rows.push(diagonal2);
  this.addEvent(window, 'resize', this.onResize.bind(this));
  this.onResize();
  this.prepareGame();
};
ticTacToe.prototype.log = function(msg) {
  if (!console) {
    return ;
  }
  if (console.log) {
    console.log(msg);
  }
};
ticTacToe.prototype.error = function(msg) {
  if (!console) {
    return ;
  }
  if (console.error) {
    console.error(msg);
  }
};
ticTacToe.prototype.play = function(player, index) {
  if (this.turn != player) {
    this.error('Player '+player+' can\'t play now.');
    return false;
  }
  if (index < 0 || index >= this.size*this.size) {
    this.error('Invalid index ('+index+'). Must be an integer between 0 and '+(this.size*this.size-1)+'.');
    return false;
  }
  if (this.board[index] != this.nobody) {
    this.error('Case ('+index+') already played!');
    return false;
  }
  this.board[index] = player;
  var square = this.squares[index];
  square.innerHTML = this.symbols[player];
  square.style.cursor = 'inherit';
  if ('onPlay' in this.opts) {
    this.opts.onPlay(player, index);
  }
  if (this.isFinish()) {
    return this.finish();
  }
  if (this.turn == this.player) {
    this.turn = this.computer;
    this.playComputer();
  }
  else {
    this.turn = this.player;
  }
};
ticTacToe.prototype.isSide = function(i, j) {
  var is_side = false;
  if (i == 0 || i == (this.size-1)) {
    if (j != 0 && j != (this.size-1)) {
      is_side = true;
    }
  }
  else {
    if (j == 0 || j == (this.size-1)) {
      is_side = true;
    }
  }
  return is_side;
};
ticTacToe.prototype.isCorner = function(i, j) {
  var is_corner = false;
  if (i == 0 || i == (this.size-1)) {
    if (j == 0 || j == (this.size-1)) {
      is_corner = true;
    }
  }
  return is_corner;
};
ticTacToe.prototype.getOppositeCorner = function(i, j) {
  var i_opposite = (i == 0 ? this.size-1 : 0);
  var j_opposite = (j == 0 ? this.size-1 : 0);
  return i_opposite*this.size + j_opposite;
}; 
ticTacToe.prototype.isFinish = function() {
  var finish = false;
  this.shuffleWinningRows();
  for(var i=0; i<this.winning_rows.length; i++) {
    var squares = this.winning_rows[i];
    var sum = 0;
    for(var j=0; j<this.size; j++) {
      sum += this.board[squares[j]];
    }
    if (sum == this.size*this.player) {
      finish = true;
      this.winner = this.player;
      break;
    }
    else if (sum == this.size*this.computer) {
      finish = true;
      this.winner = this.computer;
      break;
    }
  }
  if (!finish) {
    finish = true;
    var nb_cases = this.size*this.size;
    for(var i=0; i<nb_cases; i++) {
      if (this.board[i] == this.nobody) {
        finish = false;
        break;
      }
    }
  }
  return finish;
};
ticTacToe.prototype.finish = function() {
  if ('onFinish' in this.opts) {
    this.opts.onFinish();
  }
  var msg = 'Egalité !';
  if (this.winner != this.nobody) {
    var name = this.names[this.winner];
    msg = name+' a gagné !';
  }
  msg += ' Rejouer ?';
  if(confirm(msg)) {
  }
  this.prepareGame();
};
ticTacToe.prototype.getThirdSquare = function(player) {
  var index = -1;
  this.shuffleWinningRows();
  for(var i=0; i<this.winning_rows.length; i++) {
    var squares = this.shuffle(this.winning_rows[i]);
    var sum = 0;
    for(var j=0; j<this.size; j++) {
      sum += this.board[squares[j]];
    }
    if (sum == (this.size-1)*player) {
      for(var j=0; j<this.size; j++) {
        var index_square = squares[j];
        if (this.board[index_square] == this.nobody) {
          index = index_square;
          break;
        }
      }
    }
    if (index != -1) {
      break;
    }
  }
  return index;
};
ticTacToe.prototype.getFork = function(player) {
  var index = -1;
  var max = 0;
  var row = -1;
  this.shuffleWinningRows();
  for(var i=0; i<this.winning_rows.length; i++) {
    var squares = this.winning_rows[i];
    var sum = 0;
    var next = false;
    for(var j=0; j<this.size; j++) {
      if (this.board[squares[j]] != this.nobody && this.board[squares[j]] != player) {
        next = true;
        break;
      }
      sum += this.board[squares[j]];
    }
    if (next) {
      continue;
    }
    if (sum > max) {
      max = sum;
      row = i;
    }
  }
  if (row >= 0) {
    var squares = this.shuffle(this.winning_rows[row]);
    for(var j=0; j<this.size; j++) {
      if (this.board[squares[j]] == this.nobody) {
        index = squares[j];
        break;
      }
    }
  }
  return index;
};
ticTacToe.prototype.playComputer = function() {
  // Win
  var index = this.getThirdSquare(this.computer);
  if (index != -1) {
    this.log('win ('+index+')');
    return this.play(this.computer, index);
  }
  // Block opponent's win
  index = this.getThirdSquare(this.player);
  if (index != -1) {
    this.log('block opponent\'s win ('+index+')');
    return this.play(this.computer, index);
  }
  // Fork
  index = this.getFork(this.computer);
  if (index != -1) {
    this.log('fork ('+index+')');
    return this.play(this.computer, index);
  }
  // Block opponent's fork
  /*index = this.getFork(this.player);
  if (index != -1) {
    this.log('block opponent\'s fork ('+index+')');
    return this.play(this.computer, index);
  }*/
  // Play center
  for(var i=0; i<this.size; i++) {
    for(var j=0; j<this.size; j++) {
      if (!this.isCorner(i, j) && !this.isSide(i, j)) {
        index = i*this.size + j;
        if (this.board[index] == this.nobody) {
          this.log('play center ('+index+')');
          return this.play(this.computer, index);
        }
      }
    }
  }
  // Play opposite corner
  for(var i=0; i<this.size; i++) {
    for(var j=0; j<this.size; j++) {
      index = i*this.size + j;
      if (this.isCorner(i, j) && this.board[index] == this.player) {
        var index_opposite = this.getOppositeCorner(i, j);
        if (this.board[index_opposite] == this.nobody) {
          this.log('play opposite corner ('+index_opposite+')');
          return this.play(this.computer, index_opposite);
        }
      }
    }
  }
  // Play empty corner
  for(var i=0; i<this.size; i++) {
    for(var j=0; j<this.size; j++) {
      index = i*this.size + j;
      if (this.isCorner(i, j) && this.board[index] == this.nobody) {
        this.log('play corner ('+index+')');
        return this.play(this.computer, index);
      }
    }
  }
  // Play empty side
  for(var i=0; i<this.size; i++) {
    for(var j=0; j<this.size; j++) {
      index = i*this.size + j;
      if (this.isSide(i, j) && this.board[index] == this.nobody) {
        this.log('play side ('+index+')');
        return this.play(this.computer, index);
      }
    }
  }
  this.error('Houston, we have a problem! Not any valid square to play!');
};