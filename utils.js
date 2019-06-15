
var exec = require('child_process').exec;

module.exports = {
  promiseExec: (strCommand) => {
    return new Promise((resolve, reject) => {
      exec(strCommand, function(err, stdout, stderr) {
        console.log(stdout);
        if(err) {
          reject(err);
        } else {
          resolve({
            stdout,
            stderr
          });
        }
      });
    })
  }
}