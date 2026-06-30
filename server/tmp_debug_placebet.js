const jwt = require('jsonwebtoken');
const { config } = require('dotenv');
config();
(async () => {
  const secret = process.env.JWT_SECRET;
  const token = jwt.sign({ userId: 'cmqrypoib0009e8a3yzcmf2t7' }, secret, { expiresIn: '7d' });
  const body = {
    matchId: 'cmqrcn44p003ro6j2to0dmxca',
    oddsId: 'cmqrcn58g003to6j24j1nudun',
    stakeAmount: 100
  };
  console.log('TOKEN', token.slice(0, 20) + '...');
  const res = await fetch('http://localhost:3001/api/bets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log('STATUS', res.status);
  console.log('BODY', text);
})();
