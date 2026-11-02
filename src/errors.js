// Turns compiler/interpreter output lines into source locations (GCC/Clang, rustc, Python).
const path = require('node:path');

class ErrorParser {
  constructor(cwd) {
    this.cwd = cwd;
    this.pending = null; // rustc and Python report the message and the location on different lines
  }

  feed(line) {
    let m;
    if ((m = line.match(/^(.+?):(\d+):(\d+):\s+(?:fatal )?(error|warning):\s+(.*)$/))) return this.diag(m[1], m[2], m[3], m[4], m[5]);
    if ((m = line.match(/^(error|warning)(?:\[\w+\])?: (.*)$/))) { this.pending = { severity: m[1], message: m[2] }; return null; }
    if ((m = line.match(/^\s*--> (.+?):(\d+):(\d+)\s*$/)) && this.pending?.severity) {
      const { severity, message } = this.pending;
      this.pending = null;
      return this.diag(m[1], m[2], m[3], severity, message);
    }
    if ((m = line.match(/^\s*File "(.+?)", line (\d+)/))) { this.pending = { file: m[1], line: m[2] }; return null; }
    if ((m = line.match(/^(\w+(?:Error|Exception)): (.*)$/)) && this.pending?.file) {
      const { file, line: ln } = this.pending;
      this.pending = null;
      return this.diag(file, ln, 1, 'error', `${m[1]}: ${m[2]}`);
    }
    return null;
  }

  diag(file, line, col, severity, message) {
    return { file: path.resolve(this.cwd, file), line: +line, col: +col, severity, message };
  }
}

module.exports = { ErrorParser };
