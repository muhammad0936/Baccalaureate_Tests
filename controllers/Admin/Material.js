const Material = require('../../models/Material');
const { ensureIsAdmin } = require('../../util/ensureIsAdmin');
const { body, param, validationResult } = require('express-validator');

// Create a new material
exports.createMaterial = [
  body('name').notEmpty().withMessage('اسم المادة مطلوب.'),
  body('color').optional().isString().withMessage('يجب أن يكون اللون نصاً.'),
  body('icon.filename')
    .optional()
    .isString()
    .withMessage('يجب أن يكون اسم الملف نصاً.'),
  body('icon.accessUrl')
    .optional()
    .isString()
    .withMessage('يجب أن يكون رابط الوصول نصاً.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const material = new Material(req.body);
      await material.save();
      const { _id, name, color, icon } = material;
      res.status(201).json({
        material: { _id, name, color, icon },
      });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];

// Get materials with filters
exports.getMaterials = async (req, res) => {
  try {
    const materials = await Material.find().select(
      '-__v -createdAt -updatedAt'
    );
    res.status(200).json(materials);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || 'حدث خطأ في الخادم.' });
  }
};

// Delete a material by ID
exports.deleteMaterial = [
  param('id').isMongoId().withMessage('يرجى إدخال معرف المادة بشكل صحيح.'),
  async (req, res) => {
    try {
      await ensureIsAdmin(req.userId);
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const material = await Material.findByIdAndDelete(req.params.id);
      if (!material) {
        return res
          .status(404)
          .json({ error: 'عذراً، لم يتم العثور على المادة.' });
      }
      res.status(200).json({ message: 'تم حذف المادة بنجاح.' });
    } catch (err) {
      res
        .status(err.statusCode || 500)
        .json({ error: err.message || 'حدث خطأ في الخادم.' });
    }
  },
];
