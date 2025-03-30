const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const codesGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    codes: [
      {
        value: {
          type: String,
          required: true,
        },
        isUsed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    expiration: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return value > new Date();
        },
        message: 'Expiration date should be in the future.',
      },
    },
    materials: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Material',
      },
    ],
    courses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
  },
  { timestamps: true }
);
codesGroupSchema.index(
  { 'codes.value': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'codes.value': { $exists: true },
    },
  }
);

codesGroupSchema.index({ expiration: 1 });
codesGroupSchema.index({ materials: 1 });
codesGroupSchema.index({ courses: 1 });
codesGroupSchema.index({
  'codes.isUsed': 1,
  expiration: 1,
});
codesGroupSchema.index({ name: 'text' });
codesGroupSchema.index({ createdAt: -1 });

codesGroupSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('CodesGroup', codesGroupSchema);
