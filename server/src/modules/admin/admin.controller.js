const adminService = require('./admin.service');
const { adminSync } = require('../matches/matches.controller');

const matches = async (req, res, next) => {
  try { res.json(await adminService.getMatches(req.query)); } catch (err) { next(err); }
};

const bets = async (req, res, next) => {
  try { res.json(await adminService.getAllBets(req.query)); } catch (err) { next(err); }
};

const users = async (req, res, next) => {
  try { res.json(await adminService.getAllUsers(req.query)); } catch (err) { next(err); }
};

const withdrawals = async (req, res, next) => {
  try { res.json(await adminService.getPendingWithdrawals()); } catch (err) { next(err); }
};

const depositRequests = async (req, res, next) => {
  try { res.json(await adminService.getPendingDepositRequests()); } catch (err) { next(err); }
};

const updateWithdrawal = async (req, res, next) => {
  try {
    const result = await adminService.updateWithdrawal(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const updateDepositRequest = async (req, res, next) => {
  try {
    const result = await adminService.updateDepositRequest(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const settlements = async (req, res, next) => {
  try { res.json(await adminService.getSettlementLogs(req.query)); } catch (err) { next(err); }
};

const recalcOdds = async (req, res, next) => {
  try {
    const data = await adminService.forceRecalcOdds(req.params.matchId);
    res.json({ message: 'Odds recalculated', count: data?.length });
  } catch (err) { next(err); }
};

module.exports = { 
  matches,
  bets,
  users,
  withdrawals,
  depositRequests,
  updateWithdrawal,
  updateDepositRequest,
  settlements,
  recalcOdds,
  syncMatches: adminSync,
};
