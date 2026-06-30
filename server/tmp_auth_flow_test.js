const http = require('http');
const crypto = require('crypto');

function request(path, method, data) {
  const body = JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => text += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, body: text }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    const email = `qa-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const password = 'P@ssword123';
    console.log('Registering', email);
    const register = await request('/api/auth/register', 'POST', { email, name: 'QA User', password, confirmPassword: password, acceptedTerms: true });
    console.log('REGISTER', register.statusCode, register.statusMessage, register.body);
    if (register.statusCode !== 201) return;
    const login = await request('/api/auth/login', 'POST', { email, password });
    console.log('LOGIN', login.statusCode, login.statusMessage, login.body);
    if (login.statusCode !== 200) return;
    const data = JSON.parse(login.body);
    const token = data.token || data.accessToken;
    console.log('TOKEN', token ? `${token.slice(0, 20)}...` : null);
    const authMe = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/auth/me',
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }, (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => text += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, statusMessage: res.statusMessage, body: text }));
      });
      req.on('error', reject);
      req.end();
    });
    console.log('AUTH ME', authMe.statusCode, authMe.statusMessage, authMe.body);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();