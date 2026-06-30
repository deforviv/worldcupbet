const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('./wallet.controller');
const { auth } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../../uploads'),
    filename: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.use(auth);
router.get('/',           ctrl.get);
router.post('/deposit',   upload.single('screenshot'), validate(schemas.deposit),  ctrl.deposit);
router.post('/withdraw',  validate(schemas.withdraw), ctrl.withdraw);

module.exports = router;
