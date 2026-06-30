const router = require('express').Router();
const ctrl = require('./matches.controller');

router.get('/',          ctrl.get);
router.get('/upcoming',  ctrl.upcoming);
router.get('/results',   ctrl.results);
router.get('/:id',       ctrl.getOne);

module.exports = router;
