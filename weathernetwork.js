
var exec = require('child_process').exec;
var fs = require('fs');
var request = require('request');

var config = fs.readFileSync("./your-weathernetwork-config.json", 'utf8');
config = JSON.parse(config);

function promiseExec(strCommand) {
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
function postToSlack(imagePath) {
  return new Promise((resolve) => {
    request.post({
      url: 'https://slack.com/api/files.upload',
      formData: {
        token: config.slacktoken,
        title: "Image",
        filename: "Raspi-Weathernetwork.jpg",
        filetype: "auto",
        channels: config.slackchannel,
        file: fs.createReadStream(imagePath),
      },
    }, function (err, response) {
      resolve();
    });
  })
}

function doOnePicture() {
  return promiseExec("fswebcam -r 1280x720 ./temp/output.jpg").then((pictureComplete) => {
    console.log("took picture, posting image");
    return postToSlack("./temp/output.jpg");
  }).catch((failed) => {
    console.log("failed to take picture, posting sad sun");
    return postToSlack("./sun_sad.png");
  });
}

var lastPictureTime = -1;
function mainLogic() {
  var tmNow = new Date().getTime();
  var timeSince = tmNow - lastPictureTime;

  var prom = Promise.resolve();
  if(timeSince > config.sbetweenposts*1000) {
    prom = doOnePicture().then(() => {
      lastPictureTime = tmNow;
    });
  }

  prom.then(() => {
    setTimeout(mainLogic, 5000);
  }, (failure) => {
    console.log(failure);
  });
}

mainLogic();