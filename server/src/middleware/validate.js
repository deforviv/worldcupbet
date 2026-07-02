const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: 'Validation failed',
      details: result.error.flatten().fieldErrors,
    });
  }
  req.body = result.data;
  next();
};

// ─── Schemas ─────────────────────────────────────────────────────────────────
const schemas = {
  register: z.object({
    email: z.string().email('Invalid email'),
    name: z.string().min(2, 'Min 2 chars').max(80, 'Max 80 chars').optional(),
    username: z.string()
      .min(3, 'Min 3 chars')
      .max(30, 'Max 30 chars')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores')
      .optional(),
    password: z.string().min(6, 'Min 6 characters').max(128, 'Max 128 characters'),
    confirmPassword: z.string().min(1, 'Password confirmation required'),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: 'Terms must be accepted' }),
    }),
  }).refine(data => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  }),

  login: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),

  verifyEmail: z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/, 'Verification code must contain 6 digits'),
  }),

  resendVerificationCode: z.object({
    email: z.string().email(),
  }),

  placeBet: z.object({
    matchId: z.string().cuid(),
    oddsId: z.string().cuid(),
    stakeAmount: z.coerce.number().positive().min(1, 'Min stake 1 EUR').max(1000000000, 'Max stake 1,000,000,000 EUR'),
  }),

  placeCoupon: z.object({
    selections: z.array(z.object({
      matchId: z.string().cuid(),
      oddsId: z.string().cuid(),
    })).min(2, 'Coupon requires at least 2 selections').max(20, 'Max 20 selections per coupon'),
    stakeAmount: z.coerce.number().positive().min(1, 'Min stake 1 EUR').max(1000000000, 'Max stake 1,000,000,000 EUR'),
  }),

  deposit: z.object({
    amount: z.coerce.number().positive().min(500, 'Min deposit 500 EUR'),
    method: z.enum(['CRYPTO']),
    reference: z.string().min(1, 'Payment reference required'),
  }),

  withdraw: z.object({
    amount: z.number().positive().min(1000, 'Min withdrawal 1,000 EUR'),
    method: z.enum(['CRYPTO']),
    destination: z.string().min(5, 'Destination required'),
  }),

  updateProfile: z.object({
    username: z.string()
      .min(3, 'Min 3 chars')
      .max(30, 'Max 30 chars')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, underscores')
      .optional(),
    email: z.string().email().optional(),
  }).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  }),

  approveWithdrawal: z.object({
    status: z.enum(['APPROVED', 'REJECTED', 'PAID']),
    adminNote: z.string().optional(),
  }),

  updateDepositRequest: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    adminNote: z.string().optional(),
  }),
};

module.exports = { validate, schemas };
