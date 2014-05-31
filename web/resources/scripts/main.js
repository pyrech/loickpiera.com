
if (!String.prototype.trim) {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

var toggleClassName = function(elt, class_name_toggled) {
  var class_names_old = elt.className;

  var class_names_new = ~class_names_old.indexOf(class_name_toggled) ?
                        class_names_old.replace(class_name_toggled, '') :
                        class_names_old + ' ' + class_name_toggled;
  elt.className = class_names_new.trim();
};

var removeClassName = function(elt, class_name) {
  var class_names_old = elt.className;
  var class_names_new = class_names_old.replace(class_name, '');
  elt.className = class_names_new.trim();
};

var toggleBlock = function(elt) {
  toggleClassName(elt, 'block-closed');
  var childs = elt.childNodes;
  var container= null;
  for (var i = childs.length - 1; i >= 0; i--) {
    var child = childs[i];
    if (!child.className) continue;
    if (child.className.indexOf('block-content') > -1) {
      container = child;
      break;
    }
  };
  var margin_old = container.style.marginTop;
  var margin_new = 0;
  if (!margin_old || margin_old == '0px') {
    margin_new = '-'+container.offsetHeight+'px';
  }
  container.style.marginTop = margin_new;
};

var randomSkills = function() {
  if (!document.querySelectorAll) return;
  if (!document.getElementById('skills')) return;
  skill_li = document.querySelectorAll("#skills li");
  var skills = [];
  for (var s = 0; s < skill_li.length; s++) {
    skills.push(skill_li[s].className);
    skill_li[s].className = '';
  }
  var drawSkills = function() {
    var temp_skills = [];
    for (var i = 0; i < skills.length; i++) {
      temp_skills.push(skills[i]);
    }
    for (var j =      0; j < skill_li.length; j++) {
      var k = Math.round(Math.random()*(temp_skills.length-1));
      skill_li[j].className = temp_skills[k];
      temp_skills.splice(k, 1);
    }
  };
  /*var tempo = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
               600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500,
               1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600,
               4000, 4500, 5000, 5500, 6000];*/
  var tempo = [1, 500, 1000, 1500, 2000, 2400, 2800, 3000,
               3200, 3400, 3600, 3800, 4000,
               4100, 4200, 4300, 4400, 4500, 4600, 4700, 4800, 4900, 5000,
               5100, 5200, 5300, 5400, 5500, 5600, 5650, 5700, 5750, 5800];
  for(var t = 0; t < tempo.length; t++) {
    setTimeout(drawSkills, tempo[t]);
  }
};

if (document.querySelectorAll && Function.prototype.bind) {
  fields = document.querySelectorAll(".error-box input, .error-box select, .error-box textarea");
  for (var i = 0; i < fields.length; ++i) {
    var field = fields[i];
    var box = field.parentNode;
    if (field.addEventListener) {
      field.addEventListener('focus', function ( event ) {
        removeClassName(this, 'error-box');
      }.bind(box), true);
    }
  }
}

var skills = document.querySelector("#skills ul");
var easterEgg = function() {
  if (!skills) return;
  randomSkills();
  setTimeout(function() {
    skills.style.opacity = '1';
    skills.style.transition = 'opacity 0.5s ease';
    skills.style.opacity = '0';
  }, 5100);
  setTimeout(function() {
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', '/resources/scripts/tic-tac-toe.js');
    s.setAttribute('onload', 'document.t = new ticTacToe(document.querySelectorAll("#skills li .tile"), {"onInit": function() {skills.style.opacity = "1";}});');
    document.body.appendChild(s);
  }, 5600);
}


/*
 * Konami-JS ~ 
 * :: Now with support for touch events and multiple instances for 
 * :: those situations that call for multiple easter eggs!
 * Code: http://konami-js.googlecode.com/
 * Examples: http://www.snaptortoise.com/konami-js
 * Copyright (c) 2009 George Mandis (georgemandis.com, snaptortoise.com)
 * Version: 1.4.2 (9/2/2013)
 * Licensed under the MIT License (http://opensource.org/licenses/MIT)
 * Tested in: Safari 4+, Google Chrome 4+, Firefox 3+, IE7+, Mobile Safari 2.2.1 and Dolphin Browser
 */

var Konami = function (callback) {
  var konami = {
    addEvent: function (obj, type, fn, ref_obj) {
      if (obj.addEventListener)
        obj.addEventListener(type, fn, false);
      else if (obj.attachEvent) {
        // IE
        obj["e" + type + fn] = fn;
        obj[type + fn] = function () {
          obj["e" + type + fn](window.event, ref_obj);
        }
        obj.attachEvent("on" + type, obj[type + fn]);
      }
    },
    input: "",
    pattern: "38384040373937396665",
    load: function (link) {
      this.addEvent(document, "keydown", function (e, ref_obj) {
        if (ref_obj) konami = ref_obj; // IE
        konami.input += e ? e.keyCode : event.keyCode;
        if (konami.input.length > konami.pattern.length)
          konami.input = konami.input.substr((konami.input.length - konami.pattern.length));
        if (konami.input == konami.pattern) {
          konami.code(link);
          konami.input = "";
          e.preventDefault();
          return false;
        }
      }, this);
      this.iphone.load(link);
    },
    code: function (link) {
      window.location = link
    },
    iphone: {
      start_x: 0,
      start_y: 0,
      stop_x: 0,
      stop_y: 0,
      tap: false,
      capture: false,
      orig_keys: "",
      keys: ["UP", "UP", "DOWN", "DOWN", "LEFT", "RIGHT", "LEFT", "RIGHT", "TAP", "TAP"],
      code: function (link) {
        konami.code(link);
      },
      load: function (link) {
        this.orig_keys = this.keys;
        konami.addEvent(document, "touchmove", function (e) {
          if (e.touches.length == 1 && konami.iphone.capture == true) {
            var touch = e.touches[0];
            konami.iphone.stop_x = touch.pageX;
            konami.iphone.stop_y = touch.pageY;
            konami.iphone.tap = false;
            konami.iphone.capture = false;
            konami.iphone.check_direction();
          }
        });
        konami.addEvent(document, "touchend", function (evt) {
          if (konami.iphone.tap == true) konami.iphone.check_direction(link);
        }, false);
        konami.addEvent(document, "touchstart", function (evt) {
          konami.iphone.start_x = evt.changedTouches[0].pageX;
          konami.iphone.start_y = evt.changedTouches[0].pageY;
          konami.iphone.tap = true;
          konami.iphone.capture = true;
        });
      },
      check_direction: function (link) {
        x_magnitude = Math.abs(this.start_x - this.stop_x);
        y_magnitude = Math.abs(this.start_y - this.stop_y);
        x = ((this.start_x - this.stop_x) < 0) ? "RIGHT" : "LEFT";
        y = ((this.start_y - this.stop_y) < 0) ? "DOWN" : "UP";
        result = (x_magnitude > y_magnitude) ? x : y;
        result = (this.tap == true) ? "TAP" : result;

        if (result == this.keys[0]) this.keys = this.keys.slice(1, this.keys.length);
        if (this.keys.length == 0) {
          this.keys = this.orig_keys;
          this.code(link);
        }
      }
    }
  }

  typeof callback === "string" && konami.load(callback);
  if (typeof callback === "function") {
    konami.code = callback;
    konami.load();
  }

  return konami;
};
var easter_egg = new Konami(easterEgg);