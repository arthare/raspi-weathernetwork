
var fs = require('fs');
var request = require('request');
const createGifFromFiles = require('./gifbuilder-imagemagick');
var promiseExec = require('./utils').promiseExec;
var fetch = require('node-fetch');

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
if(!config.gifwidth) {
  console.warn("You didn't include a gifwidth in your config.  Assuming 640");
}
if(!config.giffps) {
  console.warn("You didn't include a giffps in your config to set the gif frames per second.  Assuming 6");
}

config.giflength = config.giflength || 10;
config.sbetweengifframes = config.sbetweengifframes || 60;
config.sbetweenposts = config.sbetweenposts || 1800;
config.imagemagickpath = config.imagemagickpath || 'convert';
config.gifwidth = config.gifwidth || 640;
config.giffps = config.giffps || 6;


function postToSlack(imagePath, weatherString) {
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
        title: weatherString,
        filename: imagePath,
        filetype: "auto",
        channels: config.slackchannel,
        file: fs.createReadStream(imagePath),
      },
    };
  
    request(options, function (err, res, body) {
        if(err) console.log(err);

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

  this.add = function(picFilename, picExtension) {
    ix++;

    const dstFile = `picture-queue/pic${ix}.${picExtension}`;
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
function shouldPost(date, sbetweenposts) {
  const currentMinute = date.getHours()*60 + date.getMinutes();
  if(currentMinute < lastMinute) {
    // it's a new day!
    console.log("resetting the day");
    schedulesHitToday = [];
  } else {
    console.log("day ongoing, we've posted ", schedulesHitToday);
  }
  lastMinute = currentMinute;

  const msNow = date.getTime();
  const msSince = msNow - lastPostTime;
  lastPostTime = msSince;

  let fShouldPost = false;
  if(msSince > sbetweenposts*1000) {
    fShouldPost = true;
  }
  return fShouldPost;
}

var queue = new PictureQueue();

const DEFAULT_FORECAST_STRING = "Weather!";

function getAndParseOWMInfo() {
  if(config.openweathermapapikey) {
    return fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${config.openweathermaplat}&lon=${config.openweathermaplon}&appid=${config.openweathermapapikey}`).then((result) => {
      return result.json();
    }).then((resultJson) => {
      if(resultJson && resultJson.main && resultJson.main.temp && resultJson.main.humidity) {
        const tempC = resultJson.main.temp - 273;
        const humidity = resultJson.main.humidity;
  
        return "Currently " + tempC.toFixed(0) + "C and " + humidity.toFixed(0) + "% humidity in " + resultJson.name;
      } else {
        return DEFAULT_FORECAST_STRING;
      }
    });
  } else {
    return DEFAULT_FORECAST_STRING;
  }
}

var cPictures = 0;
function doOnePicture() {
  cPictures++;

  return promiseExec(`fswebcam -r 1280x720 -F 100 ${args} ./temp/output.jpg`).then(() => {
    console.log("took picture, added it to the queue");
    queue.add('./temp/output.jpg', 'jpg');
    return './temp/output.jpg';
  }, (failure) => {
    var pic = (cPictures % 2) ? './sun_sad.png' : './sun_sad2.png';
    queue.add(pic, 'png');
    return pic;
  }).then(() => {

    const dtNow = new Date();
    if(shouldPost(dtNow, config.sbetweenposts)) {

      // time to make a GIF!
      return createGifFromFiles(queue.getFilenames(), config).then((createdGif) => {

        // build the string we're going to post alongside the image
        const owmPromise = getAndParseOWMInfo();

        return owmPromise.then((weatherString) => {
          return postToSlack(createdGif, weatherString);
        });
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
    console.log("failed main picture-take: ", failure);
  });
}

promiseExec('bash ./clean').then(() => {
  mainLogic();
});
