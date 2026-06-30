const router = require('express').Router();
const ctrl = require('./odds.controller');

router.get('/:matchId', ctrl.getForMatch);

module.exports = router;
