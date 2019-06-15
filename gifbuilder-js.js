const GIFEncoder = require('gifencoder');
const pngFileStream = require('png-file-stream');
const fs = require('fs');
 

function buildGifFromInputs(filenames, config) {
  console.log("trying to build GIF.  Filenames: ", filenames);
  return new Promise((resolve) => {
    // we want to haul "filenames" into a directory, then turn them into a gif.  We'll resolve with the file address of the GIF
    const filesMade = [];
    filenames.forEach((filename, index) => {
      const dst = `gif-build-images/input${index}.png`;
      filesMade.push(dst);
      fs.copyFileSync(filename, dst);
    });
  
    const encoder = new GIFEncoder(1280, 720);
    const stream = pngFileStream(`gif-build-images/**/input?.png`)
      .pipe(encoder.createWriteStream({ repeat: 0, delay: 333, quality: 10 }))
      .pipe(fs.createWriteStream('gif-built-images/animated.gif'));
     
    stream.on('finish', function () {
      // clean up files
      filesMade.forEach((filename) => {
        fs.unlinkSync(filename);
      })

      // Process generated GIF
      resolve('gif-built-images/animated.gif');
    });
  });

}

module.exports = buildGifFromInputs;

/*
buildGifFromInputs( [ 'picture-queue/pic1.png',
  'picture-queue/pic2.png',
  'picture-queue/pic3.png',
  'picture-queue/pic4.png' ]).then((gifAddr) => {
  console.log("built gif, it is available at ", gifAddr);
});
*/