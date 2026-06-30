const { getAllMatches, getMatchById, getUpcoming, getResults, syncMatches } = require('./matches.service');
const { generateAndSaveOdds } = require('../odds/odds.service');

const get = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await getAllMatches({
      status: status?.toUpperCase(),
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const match = await getMatchById(req.params.id);
    res.json(match);
  } catch (err) { next(err); }
};

const upcoming = async (req, res, next) => {
  try { res.json(await getUpcoming()); } catch (err) { next(err); }
};

const results = async (req, res, next) => {
  try { res.json(await getResults()); } catch (err) { next(err); }
};

const adminSync = async (req, res, next) => {
  try {
    const result = await syncMatches({ force: true });
    res.json({ message: 'Sync complete', ...result });
  } catch (err) { next(err); }
};

module.exports = { get, getOne, upcoming, results, adminSync };
