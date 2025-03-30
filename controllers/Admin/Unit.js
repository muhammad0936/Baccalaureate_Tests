const mongoose = require('mongoose');
const Unit = require('../../models/Unit');
const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new unit
exports.createUnit = [
  body('name').notEmpty().withMessage('يرجى إدخال اسم الوحدة.'),
  body('color')
    .optional()
    .isString()
    .withMessage('لون الوحدة يجب أن يكون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('اسم ملف الأيقونة يجب أن يكون نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('رابط وصول الأيقونة يجب أن يكون نصاً.'),
  body('material').isMongoId().withMessage('معرف المادة غير صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if the referenced Material exists
      const materialExists = await Material.exists({ _id: req.body.material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }

      const unit = new Unit(req.body);
      await unit.save();
      const { _id, name, color, icon, material } = unit;
      res.status(201).json({
        unit: {
          _id,
          name,
          color,
          icon,
          material,
        },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];

// Retrieve units with optional filters and pagination
exports.getUnits = async (req, res) => {
  try {
    const { page, limit, name, material } = req.query;
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: 'i' };
    }

    if (material) {
      // Validate that the material exists
      const materialExists = await Material.exists({ _id: material });
      if (!materialExists) {
        return res
          .status(400)
          .json({ message: 'عذراً، لم يتم العثور على المادة.' });
      }
      filter.material = new mongoose.Types.ObjectId(material);
    }

    const units = await Unit.paginate(filter, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      select: 'name color icon material',
    });

    res.status(200).json(units);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
  }
};

// Delete a unit by ID
exports.deleteUnit = [
  param('id').isMongoId().withMessage('يرجى إدخال رقم تعريف الوحدة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const unit = await Unit.findByIdAndDelete(req.params.id);
      if (!unit) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على الوحدة.' });
      }
      res.status(200).json({ message: 'تم حذف الوحدة بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ أثناء معالجة الطلب.' });
    }
  },
];
