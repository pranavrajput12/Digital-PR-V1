const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
const sharp = require('sharp');

const sizes = [16, 32, 48, 128];
const inputSvg = './icons/icon.svg';

async function generateIcons() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync('./icons')) {
      fs.mkdirSync('./icons');
    }

    // Generate each icon size
    for (const size of sizes) {
      const outputFile = `./icons/icon${size}.png`;
      
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(outputFile);
      
      console.log(`Generated ${outputFile} (${size}x${size})`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

// Check if sharp is installed
async function checkDependencies() {
  try {
    require.resolve('sharp');
    return true;
  } catch (e) {
    return false;
  }
}

// Run the script
async function main() {
  const hasDeps = await checkDependencies();
  if (!hasDeps) {
    console.log('Installing required dependencies...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install sharp --save-dev', { stdio: 'inherit' });
      console.log('Dependencies installed successfully!');
      await generateIcons();
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      process.exit(1);
    }
  } else {
    await generateIcons();
  }
}

main();
