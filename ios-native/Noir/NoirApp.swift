import SwiftUI
import FirebaseCore
import GoogleSignIn

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        let noirRed = UIColor(red: 1, green: 0.18, blue: 0.16, alpha: 1)
        UITabBar.appearance().tintColor = noirRed
        UISearchBar.appearance().tintColor = noirRed
        return true
    }

    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        AppOrientation.supported
    }
}

@MainActor
enum AppOrientation {
    static private(set) var supported: UIInterfaceOrientationMask = .portrait

    static func request(_ orientations: UIInterfaceOrientationMask) {
        supported = orientations
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else { return }

        scene.windows.forEach {
            $0.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
        }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientations)) { _ in }
    }
}

@main
struct NoirApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = AppStore()
    @StateObject private var authentication = AuthenticationStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .environmentObject(authentication)
                .preferredColorScheme(.dark)
                .environment(\.layoutDirection, .leftToRight)
                .task {
                    authentication.start()
                    store.connectCloud(to: authentication)
                }
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
