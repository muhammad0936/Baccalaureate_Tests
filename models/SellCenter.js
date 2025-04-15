const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const sellCenterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    address: String,
    phone: {
      type: String,
      unique: true,
    },
    image: {
      filename: String,
      accessUrl: String,
    },
  },
  { timestamps: true }
);
sellCenterSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('SellCenter', sellCenterSchema);
