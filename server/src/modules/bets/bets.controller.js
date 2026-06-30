const betsService = require('./bets.service');

const place = async (req, res, next) => {
  try {
    const bet = await betsService.placeBet(req.user.id, req.body);
    res.status(201).json(bet);
  } catch (err) { next(err); }
};

const placeCoupon = async (req, res, next) => {
  try {
    const coupon = await betsService.placeCoupon(req.user.id, req.body);
    res.status(201).json(coupon);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await betsService.getUserBets(req.user.id, req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const bet = await betsService.getBetById(req.params.id, req.user.id);
    res.json(bet);
  } catch (err) { next(err); }
};

module.exports = { place, placeCoupon, list, getOne };
