const { getOddsForMatch, generateAndSaveOdds } = require('./odds.service');

const getForMatch = async (req, res, next) => {
  try {
    const odds = await getOddsForMatch(req.params.matchId);
    res.json(odds);
  } catch (err) { next(err); }
};

const recalculate = async (req, res, next) => {
  try {
    const data = await generateAndSaveOdds(req.params.matchId);
    res.json({ message: 'Odds recalculated', count: data?.length });
  } catch (err) { next(err); }
};

module.exports = { getForMatch, recalculate };
