const app = require('./app.json');

/** Staging IPA uses its own bundle id so it can sit beside the App Store app. */
module.exports = () => {
  const expo = app.expo;
  if (process.env.APP_VARIANT !== 'staging') return expo;

  expo.ios.bundleIdentifier = 'com.crossub.inspector.staging';
  expo.ios.infoPlist.BGTaskSchedulerPermittedIdentifiers = [
    'com.crossub.inspector.staging.photo-upload.batch',
  ];
  return expo;
};
