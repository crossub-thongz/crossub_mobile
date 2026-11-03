const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

/**
 * Android 12 draws the splash mark on a white plate (`windowSplashScreenIconBackgroundColor`
 * defaults to white). That plate is the white square around the logo. Match it to the
 * splash colour the expo-splash-screen plugin already writes as `splashscreen_background`.
 * This plugin must run after `expo-splash-screen`, which creates Theme.App.SplashScreen.
 */
function withAndroidSplashIconBackground(config) {
  return withAndroidStyles(config, (mod) => {
    mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
      add: true,
      parent: { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' },
      name: 'windowSplashScreenIconBackgroundColor',
      value: '@color/splashscreen_background',
    });
    return mod;
  });
}

module.exports = withAndroidSplashIconBackground;
