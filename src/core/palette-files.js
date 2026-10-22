  // src/core/palette-files.js
  var HEX7 = /^#[0-9a-f]{6}$/;
  var hex2 = (v) => v.toString(16).padStart(2, "0");
  var toHex = (r, g, b) => "#" + hex2(r) + hex2(g) + hex2(b);
  var rgbOf3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  var byte = (s) => {
    const v = Number(s);
    return Number.isInteger(v) && v >= 0 && v <= 255 && /^\d+$/.test(s) ? v : null;
  };
  function readGpl(text) {
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    if (lines[0].trim() !== "GIMP Palette") throw new Error('Not a GIMP palette: the first line must be "GIMP Palette".');
    let name = "", columns = 0;
    const colours = [];
    for (const [k, raw] of lines.slice(1).entries()) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^Name:\s*(.*)$/.exec(line);
      if (m) {
        name = m[1];
        continue;
      }
      const c = /^Columns:\s*(\d+)$/.exec(line);
      if (c) {
        columns = Number(c[1]);
        continue;
      }
      const p = /^(\d+)\s+(\d+)\s+(\d+)(?:\s+(.*))?$/.exec(line);
      const rgb = p && [p[1], p[2], p[3]].map(byte);
      if (!p || rgb.includes(null)) throw new Error(`GIMP palette line ${k + 2} is not "red green blue name": ${raw.slice(0, 40)}`);
      colours.push({ hex: toHex(...rgb), name: p[4] ?? "" });
    }
    return { name, columns, colours };
  }
  function writeGpl({ name = "", columns = 0, colours }) {
    const rows = colours.map(({ hex, name: n }) => rgbOf3(hex).map((v) => String(v).padStart(3, " ")).join(" ") + (n ? "	" + n : ""));
    return ["GIMP Palette", "Name: " + name, "Columns: " + columns, "#", ...rows].join("\n") + "\n";
  }
  function readPal(text) {
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
    if (lines[0] !== "JASC-PAL") throw new Error('Not a JASC palette: the first line must be "JASC-PAL".');
    const n = Number(lines[2]);
    if (!Number.isInteger(n) || n < 0) throw new Error("JASC palette: the colour count on line 3 is missing.");
    const colours = [];
    for (let k = 0; k < n; k++) {
      const parts = (lines[3 + k] || "").split(/\s+/), rgb = parts.length === 3 ? parts.map(byte) : [null];
      if (rgb.includes(null)) throw new Error(`JASC palette line ${4 + k} is not "red green blue".`);
      colours.push({ hex: toHex(...rgb), name: "" });
    }
    return { name: "", columns: 0, colours };
  }
  var writePal = ({ colours }) => ["JASC-PAL", "0100", String(colours.length), ...colours.map((c) => rgbOf3(c.hex).join(" "))].join("\r\n") + "\r\n";
  function readHex(text) {
    const colours = [];
    for (const [k, raw] of String(text).replace(/\r\n?/g, "\n").split("\n").entries()) {
      const line = raw.trim();
      if (!line) continue;
      const m = /^#?([0-9a-fA-F]{6})$/.exec(line);
      if (!m) throw new Error(`Hex palette line ${k + 1} is not a colour like ff8800: ${raw.slice(0, 40)}`);
      colours.push({ hex: "#" + m[1].toLowerCase(), name: "" });
    }
    return { name: "", columns: 0, colours };
  }
  var writeHex = ({ colours }) => colours.map((c) => c.hex.slice(1)).join("\n") + "\n";
  function readPaletteFile(fileName, text) {
    const ext = String(fileName).toLowerCase().split(".").pop();
    if (ext === "gpl") return readGpl(text);
    if (ext === "pal") return readPal(text);
    if (ext === "hex" || ext === "txt") return readHex(text);
    throw new Error("Palette files are .gpl (GIMP), .pal (JASC) or .hex.");
  }
  function writePaletteFile(format, palette) {
    if (format === "gpl") return writeGpl(palette);
    if (format === "pal") return writePal(palette);
    if (format === "hex") return writeHex(palette);
    throw new Error("Unknown palette format " + format);
  }
  function paletteColours(palette, max) {
    const all = palette.colours.map((c) => c.hex).filter((h) => HEX7.test(h)), unique2 = [...new Set(all)];
    return { colours: unique2.slice(0, max), duplicates: all.length - unique2.length, dropped: Math.max(0, unique2.length - max) };
  }
  var asPalette = (colours, name = "Sprite Foundry") => ({ name, columns: Math.min(16, colours.length), colours: colours.map((hex) => ({ hex, name: hex })) });

