const https = require('https');

const urls = [
  'https://upload.wikimedia.org/wikipedia/commons/b/b4/Lionel-Messi-Argentina-2022-FIFA-World-Cup_%28cropped%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/b/bb/Neymar_Jr._with_Al_Hilal%2C_3_October_2023_-_03_%28cropped%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/c/c9/Lamine_Yamal_a_Xina_%282025%29.png',
  'https://upload.wikimedia.org/wikipedia/commons/5/57/Kylian_Mbapp%C3%A9_2024.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/c/c0/Harry_Kane_2024_%28cropped%29.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/f/f5/Esteghlal_F.C._v_Al_Nassr_FC%2C_3_March_2025%2C_Sadio_Man%C3%A9.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mohamed_Salah_2018.jpg',
  'https://upload.wikimedia.org/wikipedia/commons/4/44/Vin%C3%ADcius_J%C3%BAnior_2023.jpg'
];

async function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve({ url, status: res.statusCode });
    }).on('error', () => resolve({ url, status: 'error' }));
  });
}

async function run() {
  for (const url of urls) {
    const res = await checkUrl(url);
    console.log(`${res.status}: ${res.url}`);
  }
}
run();
