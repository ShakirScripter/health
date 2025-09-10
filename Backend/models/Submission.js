const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  patientId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  note: {
    type: String,
    default: ''
  },
  originalImageUrl: {
    type: String,
    required: true
  },
  annotatedImageUrl: {
    type: String
  },
  reportUrl: {
    type: String
  },
  annotationJson: {
    type: Object
  },
  status: {
    type: String,
    enum: ['uploaded', 'annotated', 'reported'],
    default: 'uploaded'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  annotatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema);