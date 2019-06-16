
var fs = require('fs');
var request = require('request');
const createGifFromFiles = require('./gifbuilder-imagemagick');
var promiseExec = require('./utils').promiseExec;

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
if(!config.giflength) {
  console.warn("You didn't include a length for your posted GIFs in config.giflength.  Defaulting to 10")
}
if(!config.sbetweengifframes) {
  console.warn("You didn't include a time between your GIF frames, so we'll use approximately 60s");
}
if(!config.imagemagickpath) {
  console.warn("You didn't include a path to imagemagick's convert binary.  Assuming 'convert'.  On windows this will not be correct");
}

config.giflength = config.giflength || 10;
config.sbetweengifframes = config.sbetweengifframes || 60;
config.sbetweenposts = config.sbetweenposts || 1800;
config.imagemagickpath = config.imagemagickpath || 'convert';

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
        filename: "Raspi-Weathernetwork.gif",
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
  })
}

const args = process.argv[2] || "";

function PictureQueue() {
  // this will keep a bunch of pictures in ./picture-queue
  var ix = 0;
  var pictures = [];

  try {
    fs.rmdirSync('./picture-queue');
  } catch(e) {
    // this is totally fine
  }

  try {
    fs.mkdirSync('./picture-queue');
    
  } catch(e) {
    console.error("Could not create ./picture-queue to store the GIF source files");
  }

  function cleanPictures() {
    // if the pictures array is too long, we'll clean it up
    if(pictures.length > config.giflength) {
      const newPictures = pictures.slice(-config.giflength);
      const delPictures = pictures.slice(0, pictures.length - config.giflength);

      delPictures.forEach((filename) => {
        console.log("deleting ", filename);
        fs.unlinkSync(filename);
      });

      pictures = newPictures;
    }
  }

  this.add = function(picFilename) {
    ix++;

    const dstFile = `picture-queue/pic${ix}.png`;
    fs.copyFileSync(picFilename, dstFile);
    pictures.push(dstFile);

    cleanPictures();
  }

  this.getFilenames = function() {
    return pictures.slice();
  }
}

var lastPostTime = new Date().getTime();
var lastMinute = 1440;
var schedulesHitToday = [];
function shouldPost(date, sbetweenposts, schedule) {
  console.log("checking if we should post ----------------");
  const currentMinute = date.getHours()*60 + date.getMinutes();
  if(currentMinute < lastMinute) {
    // it's a new day!
    console.log("resetting the day");
    schedulesHitToday = [];
  } else {
    console.log("day ongoing, we've posted ", schedulesHitToday);
  }
  lastMinute = currentMinute;

  var fFound = false;
  if(schedule) {
    // we should loop through the schedule, and post everything that is in the past
    schedule.forEach((scheduledMinute) => {
      if(scheduledMinute < currentMinute) {
        // this scheduled minute is in the past, so we should post it, if we haven't already posted this minute
        const found = schedulesHitToday.find(postedMinute => postedMinute === scheduledMinute);
        console.log("we found ", found, " when searching for ", scheduledMinute);
        if(found) {
          // we already posted this one
          console.log("skipping posting because we have posted for scheduled minute ", scheduledMinute);
        } else {
          // we haven't posted this one
          schedulesHitToday.push(scheduledMinute);
          console.log("posting because we haven't posted for scheduled minute ", scheduledMinute, "yet");
          fFound = true;
        }
      }
    })
  } else {
    // they didn't include a schedule, so we just need to see if it has been long enough since last post
    const msNow = date.getTime();
    const msSince = msNow - lastPostTime;
    lastPostTime = msSince;
    if(msSince > sbetweenposts*1000) {
      fFound = true;
    }
  }
  return fFound;
}

var queue = new PictureQueue();

var cPictures = 0;
function doOnePicture() {
  cPictures++;

  return promiseExec(`fswebcam -F 100 ${args} ./temp/output.jpg`).then(() => {
    return './temp/output.jpg';
  }, (failure) => {
    return (cPictures % 2) ? './sun_sad.png' : './sun_sad2.png';
  }).then((fileToPost) => {
    console.log("adding ", fileToPost, "to the queue");
    queue.add(fileToPost);

    const dtNow = new Date();
    if(shouldPost(dtNow, config.sbetweenposts, config.scheduleminutes)) {

      // time to make a GIF!
      return createGifFromFiles(queue.getFilenames(), config).then((createdGif) => {
        console.log("we created a gif!", createdGif);
        return postToSlack(createdGif).then(() => {
        })
      }, (failure) => {
        console.log("we failed ", failure);
      });
    } else {

    }
  });
}

function mainLogic() {

  prom = doOnePicture();

  prom.then(() => {
    setTimeout(mainLogic, config.sbetweengifframes*1000);
  }, (failure) => {
    console.log(failure);
  });
}

mainLogic();
