var sys = require('util')
var exec = require('child_process').exec;
var Slack = require('slack-node');
var fs = require('fs');

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
function postToSlack(channel, content) {
  return new Promise((resolve) => {
    slack = new Slack();
    slack.setWebhook(config.slackwebhook);
    
    slack.webhook({
      channel: config.slackchannel,
      username: config.slackusername,
      text: content,
      icon_emoji: ":sunny:",
      attachments: [{
        image_url: `http://${config.uploadserver}${config.visiblepath}`,
      }
      ]
    }, function(err, response) {
      console.log(response);
      resolve();
    });
  })
}

function doOnePicture() {
  console.log("picture");
  return promiseExec("fswebcam -r 1280x720 ./temp/output.jpg").then((pictureComplete) => {
    console.log(pictureComplete);

    var scpCommand = `scp -i ${config.uploadprivatekey} ./temp/output.jpg ${config.uploaduser}@${config.uploadserver}:${config.uploadpath}`;
    console.log("executing ", scpCommand);
    return promiseExec(scpCommand).then(() => {
      return postToSlack("", "test");
    });
  }).catch((failed) => {
    console.log("failed to take picture");
  });
}

var lastPictureTime = -1;
function mainLogic() {
  console.log("logic");
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
  });
}

mainLogic();