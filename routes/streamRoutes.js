const { spawn } = require('child_process');

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=ffserver',
    'Cache-Control': 'no-cache',
    'Connection': 'close',
    'Pragma': 'no-cache'
  });

  const ffmpeg = spawn('ffmpeg', [
    '-i', 'rtsp://admin:admin@192.168.100.54:554',
    '-f', 'mjpeg',
    '-q:v', '5',
    '-r', '10',
    '-'
  ]);

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on('data', (data) => {
    console.error('FFmpeg error:', data.toString());
  });

  req.on('close', () => {
    ffmpeg.kill('SIGINT');
  });
});
