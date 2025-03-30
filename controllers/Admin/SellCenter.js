const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const SellCenter = require('../../models/SellCenter'); // Adjust path as necessary
const { body, param, validationResult } = require('express-validator');

// Create a new sell center
exports.createSellCenter = [
  // Validate input fields
  body('name').notEmpty().withMessage('Name is required.'),
  body('phone').optional().isString().withMessage('Phone must be a string.'),
  body('address')
    .optional()
    .isString()
    .withMessage('address must be a string.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellCenter = new SellCenter(req.body);
      await sellCenter.save();
      const { _id, name, phone, address } = sellCenter;

      res.status(201).json({ sellCenter: { _id, name, phone, address } });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'An error occurred on the server.' });
    }
  },
];

exports.getSellCenters = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const sellCenters = await SellCenter.paginate(
      {},
      { page: page || 1, limit: limit || 10, select: 'name phone address' }
    );
    res.status(200).json(sellCenters);
  } catch (err) {
    res.status(500).json({ error: 'An error occurred on the server.' });
  }
};

exports.deleteSellCenter = [
  param('id').isMongoId().withMessage('Please provide a valid Sell Center ID.'),

  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const sellCenter = await SellCenter.findByIdAndDelete(req.params.id);
      if (!sellCenter) {
        return res.status(404).json({ error: 'Sell Center not found.' });
      }

      res.status(200).json({ message: 'Sell Center successfully deleted.' });
    } catch (err) {
      res.status(500).json({ error: 'An error occurred on the server.' });
    }
  },
];
