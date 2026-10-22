  // src/import/directions.js
  var DIRECTIONS = ["S", "E", "W", "N", "SE", "SW", "NE", "NW"];
  var DIRECTION_LABEL = {
    S: "south \xB7 facing the viewer",
    E: "east \xB7 facing right",
    W: "west \xB7 facing left",
    N: "north \xB7 the back",
    SE: "south-east \xB7 front, turned right",
    SW: "south-west \xB7 front, turned left",
    NE: "north-east \xB7 back, turned right",
    NW: "north-west \xB7 back, turned left"
  };
  var FACING_OF = { S: "front", E: "right", W: "left", N: "front", SE: "right", SW: "left", NE: "right", NW: "left" };
  var MAX_VIEWS = DIRECTIONS.length - 1;
  function directionFromFacing(facing) {
    return facing === "left" ? "W" : facing === "front" ? "S" : "E";
  }
  var CIRCLE = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"];
  var rowName = (anim2, dir, mainDir2) => dir === mainDir2 ? anim2 : `${anim2}_${dir.toLowerCase()}`;

