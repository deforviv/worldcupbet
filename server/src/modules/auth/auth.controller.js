const authService = require('./auth.service');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

const updateMe = async (req, res, next) => {
  try {
    const updatedUser = await authService.updateProfile(req.user.id, req.body);
    res.json({ user: updatedUser });
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const result = await authService.refreshToken(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
};

const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const resendCode = async (req, res, next) => {
  try {
    const result = await authService.resendVerificationCode(req.body);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { register, login, me, updateMe, refresh, verifyEmail, resendCode };
