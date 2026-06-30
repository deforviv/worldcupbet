const walletService = require('./wallet.service');

const get = async (req, res, next) => {
  try { res.json(await walletService.getWallet(req.user.id)); } catch (err) { next(err); }
};

const deposit = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.screenshotUrl = `/uploads/${req.file.filename}`;
    }
    const result = await walletService.deposit(req.user.id, data);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const withdraw = async (req, res, next) => {
  try {
    const result = await walletService.requestWithdrawal(req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

module.exports = { get, deposit, withdraw };
