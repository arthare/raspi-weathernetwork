var fs = require('fs');
var promiseExec = require('./utils').promiseExec;

try {
	fs.mkdirSync('./gif-build-images');
} catch(e) {}
try {
	fs.mkdirSync('./gif-built-images');
} catch(e) {}

function buildGifFromInputs(filenames, config) {
  return new Promise((resolve, reject) => {
    // we want to haul "filenames" into a directory, then turn them into a gif.  We'll resolve with the file address of the GIF
    const filesMade = [];

    filenames.forEach((filename, index) => {
      const indexAsString = '' + index;
      const indexZeroPadded = indexAsString.padStart(4, '0');
      const dst = `gif-build-images/input${indexZeroPadded}.jpg`;
      filesMade.push(dst);
      fs.copyFileSync(filename, dst);
    });
  
    return promiseExec('rm gif-built-images/animated.gif').then(() => {
    }, (failure) => {
    }).then(() => {
      const gifPath = `gif-built-images/animated${new Date().getTime()}.gif`;
      const gifDelay = Math.ceil(100 / config.giffps);
      return promiseExec(`${config.imagemagickpath} -resize ${config.gifwidth}x -delay ${gifDelay} -loop 0 gif-build-images/input*.jpg ${gifPath}`).then(() => {
        filesMade.forEach((filename) => {
          fs.unlinkSync(filename);
        })
  
        resolve(gifPath);
      }, (failure) => {
        console.log("failure!", failure);
        reject(failure);
      })
    });
  });

}

module.exports = buildGifFromInputs;

/*
buildGifFromInputs( [ 'picture-queue/pic1.png',
  'picture-queue/pic2.png',
  'picture-queue/pic3.png',
  'picture-queue/pic4.png' ], {
    imagemagickpath: "\"c:\\Program Files\\ImageMagick-7.0.8-Q16\\convert.exe\""
  }).then((gifAddr) => {
  console.log("built gif, it is available at ", gifAddr);
});
*/
