const http = require('http');

const opts = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/admin/users',
  method: 'GET',
  headers: {
    Authorization: 'Bearer local-admin-token',
  },
};

const req = http.request(opts, (res) => {
  console.log('STATUS', res.statusCode, res.statusMessage);
  console.log('HEADERS', res.headers);
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    console.log('BODY', body);
  });
});

req.on('error', (err) => {
  console.error('ERR', err);
});

req.end();
