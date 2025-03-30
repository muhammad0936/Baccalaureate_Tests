const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const courseSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    material: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
    },
    promoVideo720: {
      accessUrl: String,
      videoId: String,
      libraryId: String,
      donwnloadUrl: String,
    },
    promoVideo480: {
      accessUrl: String,
      videoId: String,
      libraryId: String,
      donwnloadUrl: String,
    },
  },
  { timestamps: true }
);
courseSchema.plugin(mongoosePaginate);
courseSchema.index({ material: 1 });
courseSchema.index({ teacher: 1 });

module.exports = mongoose.model('Course', courseSchema);
