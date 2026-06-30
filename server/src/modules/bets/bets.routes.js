const router = require('express').Router();
const ctrl = require('./bets.controller');
const { auth } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

router.use(auth);
router.post('/coupon', validate(schemas.placeCoupon), ctrl.placeCoupon);
router.post('/',    validate(schemas.placeBet), ctrl.place);
router.get('/',    ctrl.list);
router.get('/:id', ctrl.getOne);

module.exports = router;
