const { AndroidConfig, withAndroidStyles } = require('expo/config-plugins');

/**
 * Android style mods run last-registered first, and expo-splash-screen replaces
 * the whole splash theme. This plugin is listed before expo-splash-screen so it
 * runs after that replacement.
 *
 * The logo is a white-backed bitmap. Xiaomi force-dark turns the splash window
 * grey and leaves the bitmap white, which is the white square on a grey screen.
 * Pin the splash window to the icon colour and turn force-dark off for that theme.
 */
function withAndroidSplashIconBackground(config) {
  return withAndroidStyles(config, (mod) => {
    const parent = { name: 'Theme.App.SplashScreen', parent: 'Theme.SplashScreen' };
    const splash = '@color/splashscreen_background';
    const items = {
      windowSplashScreenBackground: splash,
      'android:windowSplashScreenBackground': splash,
      windowSplashScreenIconBackgroundColor: splash,
      'android:windowBackground': splash,
      'android:colorBackground': splash,
      'android:statusBarColor': splash,
      'android:navigationBarColor': splash,
      'android:windowLightStatusBar': 'true',
      'android:windowLightNavigationBar': 'true',
      'android:forceDarkAllowed': 'false',
    };
    for (const [name, value] of Object.entries(items)) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent,
        name,
        value,
      });
    }
    return mod;
  });
}

module.exports = withAndroidSplashIconBackground;
