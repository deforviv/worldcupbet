const router = require('express').Router();
const ctrl = require('./admin.controller');
const { auth, adminOnly } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

router.use(auth, adminOnly);

router.get('/matches',                 ctrl.matches);
router.post('/matches/sync',           ctrl.syncMatches);
router.post('/odds/recalc/:matchId',   ctrl.recalcOdds);
router.get('/bets',                    ctrl.bets);
router.get('/users',                   ctrl.users);
router.get('/withdrawals',             ctrl.withdrawals);
router.patch('/withdrawals/:id',       validate(schemas.approveWithdrawal), ctrl.updateWithdrawal);
router.get('/deposit-requests',         ctrl.depositRequests);
router.patch('/deposit-requests/:id',   validate(schemas.updateDepositRequest), ctrl.updateDepositRequest);
router.get('/settlements',             ctrl.settlements);

module.exports = router;
