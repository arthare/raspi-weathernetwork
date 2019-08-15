// this script is to go through your channel and wipe out old images, so you don't overwhelm your slack

var fs = require('fs');
var request = require('request');

var config = fs.readFileSync("./your-weathernetwork-config.json", 'utf8');
config = JSON.parse(config);

const userAccessToken = config.slackusertoken;

function listFiles(page) {
  
  return new Promise((resolve) => {
    
    const options = {
      method: "GET",
      url: `https://slack.com/api/files.list?page=${page}&channel=${config.slackchannelid}&count=50&token=${userAccessToken}`,
      port: 443,
    };
  
    request(options, function (err, res, body) {
        if(err) console.log(err);

        resolve(JSON.parse(body));
    });
  });
}

function deleteFile(id) {
  return new Promise((resolve, reject) => {
    
    const options = {
      method: "POST",
      url: "https://slack.com/api/files.delete",
      port: 443,
      headers: {
          "Authorization": `Bearer ` + config.slacktoken,
          "Content-Type": "multipart/form-data"
      },
      formData : {
        file: id,
      },
    };

    request(options, function (err, res, body) {
        if(err) console.log(err);

        console.log("delete attempt on ", id, " complete: ", body);
        const bodyJson = JSON.parse(body);
        if(bodyJson.error === "ratelimited") {
          // ok, we're done here
          reject();
        } else {
          resolve(JSON.parse(body));
        }
    });
  });
}

function accumulateFiles(page) {
  console.log("deleting files on page ", page);
  return listFiles(page).then((result) => {

    console.log("there are ", result.paging.total, " files left to delete");

    result.files = result.files.filter((file) => {
      return file.mimetype === "image/gif" && file.channels.length === 1 && file.channels[0] === config.slackchannelid;
    });

    const toDelete = result.files.map((file) => {
      return deleteFile(file.id).then(() => {
        console.log("deleted ", file.title);
      })
    });

    const delay = (90000 / 50) * result.files.length;
    return Promise.all(toDelete).then(() => {
      if(page < result.paging.pages) {
        setTimeout(() => {
          accumulateFiles(page + 1);
        }, delay);
      }
    }).catch(() => {
      console.log("we must have gotten rate limited");
      process.exit();
    })
  });
}


accumulateFiles(1);
//deleteFile("FM1CTD266");