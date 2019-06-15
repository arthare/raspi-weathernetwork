var fs = require('fs');
var promiseExec = require('./utils').promiseExec;

function buildGifFromInputs(filenames, config) {
  console.log("trying to build GIF.  Filenames: ", filenames, config);
  return new Promise((resolve, reject) => {
    // we want to haul "filenames" into a directory, then turn them into a gif.  We'll resolve with the file address of the GIF
    const filesMade = [];
    filenames.forEach((filename, index) => {
      const dst = `gif-build-images/input${index}.png`;
      filesMade.push(dst);
      fs.copyFileSync(filename, dst);
    });
  
    return promiseExec('rm gif-built-images/animated.gif').then(() => {
    }, (failure) => {
    }).then(() => {
      return promiseExec(`${config.imagemagickpath} -delay 33 -loop 0 gif-build-images/input*.png gif-built-images/animated.gif`).then(() => {
        filesMade.forEach((filename) => {
          fs.unlinkSync(filename);
        })
  
        resolve('gif-built-images/animated.gif');
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