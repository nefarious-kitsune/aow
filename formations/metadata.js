import sharp from 'sharp';
// const {sharp} = sharpPkg;

const imageMetadata = async () => {
  const metadata = await sharp('./robo.jpeg').metadata()

  console.log(metadata)
}

imageMetadata();
