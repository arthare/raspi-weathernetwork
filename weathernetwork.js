
var exec = require('child_process').exec;
var fs = require('fs');
var request = require('request');

var config = fs.readFileSync("./your-weathernetwork-config.json", 'utf8');
config = JSON.parse(config);

if(!config.slacktoken) {
	console.error("You need to include a 'slacktoken' field in your-weathernetwork-config.json!  You can get it from your slack app's config scopes");
	process.exit(1);
}
if(!config.slackchannel) {
	console.error("You need to include a 'slackchannel' field in your-weathernetwork-config.json!  It'll need to match the channel you config'd the weathernetwork app to use");
	process.exit(1);
}
if(!config.sbetweenposts) {
	console.warn("You didn't include a seconds between posts.  We're going to set this to half an hour");
}

config.sbetweenposts = config.sbetweeposts || 1800;


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
  console.log("going to try to post to slack");
  return new Promise((resolve) => {
    console.log("about to do request.post");
    
    const options = {
      method: "POST",
      url: "https://slack.com/api/files.upload",
      port: 443,
      headers: {
          "Authorization": `Bearer ` + config.slacktoken,
          "Content-Type": "multipart/form-data"
      },
      formData : {
        //token: config.slacktoken,
        title: "Image",
        filename: "Raspi-Weathernetwork.jpg",
        filetype: "auto",
        channels: config.slackchannel,
        file: fs.createReadStream(imagePath),
      },
    };
  
    request(options, function (err, res, body) {
        if(err) console.log(err);
        console.log(body);

        resolve();
    });
    
    /*request.post({
      url: 'https://slack.com/api/files.upload',
      headers: {
        "Authorization": `Bearer ${config.slacktoken}`,
        "Content-Type": "multipart/form-datazz",
      },
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
    });*/
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
