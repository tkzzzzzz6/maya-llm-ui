const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // 允许所有设备访问
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// HTTPS 选项
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'localhost+3-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost+3.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .listen(port, hostname, (err) => {
      if (err) throw err;
      console.log('\n' + '='.repeat(60));
      console.log('🔒 HTTPS Server Started (Secure Context Enabled)');
      console.log('='.repeat(60));
      console.log('');
      console.log('  📱 Access from:');
      console.log(`     Local:    https://localhost:${port}`);
      console.log(`     Network:  https://192.168.243.171:${port}`);
      console.log('');
      console.log('  ✅ Camera & Microphone access enabled on all devices');
      console.log('');
      console.log('  💡 First-time access:');
      console.log('     1. Browser will show "Not Secure" warning');
      console.log('     2. Click "Advanced" -> "Continue to site"');
      console.log('     3. Certificate will be trusted for future visits');
      console.log('');
      console.log('='.repeat(60) + '\n');
    });
});
