const router = require('express').Router();
const multer = require('multer');
const ctrl = require('./wallet.controller');
const { auth } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { screenshotStorage } = require('../../config/cloudinary');

// Uploads go directly to Cloudinary — no local disk storage (Vercel-compatible)
const upload = multer({
  storage: screenshotStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non autorisé. Utilisez JPG, PNG ou WebP.'));
    }
  },
});

router.use(auth);
router.get('/',          ctrl.get);
router.post('/deposit',  upload.single('screenshot'), validate(schemas.deposit), ctrl.deposit);
router.post('/withdraw', validate(schemas.withdraw), ctrl.withdraw);

module.exports = router;
