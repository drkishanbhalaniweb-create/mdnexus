const { execSync } = require('child_process');

// Check if we're running on Vercel
const isVercel = process.env.VERCEL === '1' || process.env.CI === 'true';

// Run react-snap (Pre-rendering)
console.log('🚀 Attempting to run react-snap for pre-rendering...');
try {
  // We attempt to run it even on Vercel. 
  // If it fails (due to missing Puppeteer/Chrome), we catch the error 
  // and proceed so the build is not broken.
  execSync('react-snap', { stdio: 'inherit' });
  console.log('✅ Pre-rendering complete!');
} catch (error) {
  console.warn('⚠️  react-snap failed or was skipped.');
  console.warn('   This is expected if running in an environment without Puppeteer (like standard Vercel builds).');
  console.warn('   The site will fallback to client-side rendering.');
  console.warn('Error details:', error.message);
  // We do NOT exit with error, allowing the build to succeed without pre-rendering if necessary.
  process.exit(0);
}
