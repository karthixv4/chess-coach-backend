const FEATURES = require('../config/features');

const checkFeature = (featureName) => {
  return (req, res, next) => {
    if (!FEATURES[featureName]) {
      return res.status(403).json({ success: false, message: 'Feature disabled' });
    }
    next();
  };
};

module.exports = { checkFeature };
