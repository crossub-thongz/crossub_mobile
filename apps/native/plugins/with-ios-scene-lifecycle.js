const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const SCENE_MARKER = 'The window is created by SceneDelegate';

const SCENE_DELEGATE = `
@objc(SceneDelegate)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)
    appDelegate.window = window
    self.window = window

    for context in connectionOptions.urlContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = RCTLinkingManager.application(
        UIApplication.shared,
        continue: activity,
        restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared,
      continue: userActivity,
      restorationHandler: { _ in })
  }
}
`;

function applyAppDelegate(contents) {
  if (contents.includes(SCENE_MARKER)) return contents;
  let next = contents;
  if (!next.includes('import UIKit')) {
    next = next.replace('import ReactAppDependencyProvider\n', 'import ReactAppDependencyProvider\nimport UIKit\n');
  }
  if (!next.includes('var launchOptions:')) {
    next = next.replace(
      'var reactNativeFactory: RCTReactNativeFactory?\n',
      'var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
    );
  }
  next = next.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?#endif\n\n    return super\.application/,
    `// ${SCENE_MARKER} (required by the iOS 27 SDK).
    self.launchOptions = launchOptions
    return super.application`,
  );
  if (!next.includes('class SceneDelegate:')) {
    next = next.replace('\nclass ReactNativeDelegate:', `${SCENE_DELEGATE}\nclass ReactNativeDelegate:`);
  }
  return next;
}

module.exports = function withIosSceneLifecycle(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'SceneDelegate',
          },
        ],
      },
    };
    return mod;
  });
  config = withAppDelegate(config, (mod) => {
    if (mod.modResults.language !== 'swift') return mod;
    mod.modResults.contents = applyAppDelegate(mod.modResults.contents);
    return mod;
  });
  return config;
};
