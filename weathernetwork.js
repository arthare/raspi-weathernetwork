
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
if(!config.gifwidth) {
  console.warn("You didn't include a gifwidth in your config.  Assuming 640");
}

config.giflength = config.giflength || 10;
config.sbetweengifframes = config.sbetweengifframes || 60;
config.sbetweenposts = config.sbetweenposts || 1800;
config.imagemagickpath = config.imagemagickpath || 'convert';
config.gifwidth = config.gifwidth || 640;


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
        filename: imagePath,
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

var queue = new PictureQueue();

var lastPostToSlackTime = new Date().getTime();
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
  }).then((fileToPost) => {

    const tmNow = new Date().getTime();
    const msSince = tmNow - lastPostToSlackTime;
    if(msSince > config.sbetweenposts*1000) {

      // time to make a GIF!
      return createGifFromFiles(queue.getFilenames(), config).then((createdGif) => {
        console.log("we created a gif!", createdGif);
        return postToSlack(createdGif).then(() => {
          lastPostToSlackTime = new Date().getTime(); // don't reuse tmNow, because on the raspi, tmNow might be like 30 seconds behind by now anyway!
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
    console.log("failed main picture-take: ", failure);
  });
}

promiseExec('./clean').then(() => {
  mainLogic();
});
