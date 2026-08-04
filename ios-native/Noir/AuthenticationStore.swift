import FirebaseAuth
import FirebaseCore
import Foundation
import GoogleSignIn
import UIKit

@MainActor
final class AuthenticationStore: ObservableObject {
    @Published private(set) var user: User?
    @Published private(set) var isSigningIn = false
    @Published var errorMessage: String?

    private var authListener: AuthStateDidChangeListenerHandle?

    func start() {
        guard authListener == nil, FirebaseApp.app() != nil else { return }
        user = Auth.auth().currentUser
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in
                self?.user = user
            }
        }
    }

    var displayName: String {
        user?.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "Noir Account"
    }

    var email: String? {
        user?.email
    }

    var photoURL: URL? {
        user?.photoURL
    }

    func signInWithGoogle() async -> Bool {
        guard !isSigningIn else { return false }
        guard FirebaseApp.app() != nil else {
            errorMessage = "Firebase could not be initialized."
            return false
        }
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            errorMessage = "Google Sign-In configuration is missing."
            return false
        }
        guard let presenter = Self.presentingViewController() else {
            errorMessage = "No screen is available to present Google Sign-In."
            return false
        }

        isSigningIn = true
        errorMessage = nil
        defer { isSigningIn = false }

        do {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter)
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Google did not return a valid identity token."
                return false
            }

            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            let authResult = try await Auth.auth().signIn(with: credential)
            user = authResult.user
            UserDefaults.standard.set("google", forKey: "noir.ios.account.mode")
            return true
        } catch let error as NSError where error.code == GIDSignInError.canceled.rawValue {
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func signOut() throws {
        GIDSignIn.sharedInstance.signOut()
        try Auth.auth().signOut()
        user = nil
        UserDefaults.standard.set("guest", forKey: "noir.ios.account.mode")
    }

    private static func presentingViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .filter { $0.activationState == .foregroundActive }

        let root = scenes
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController

        return topViewController(from: root)
    }

    private static func topViewController(from controller: UIViewController?) -> UIViewController? {
        if let presented = controller?.presentedViewController {
            return topViewController(from: presented)
        }
        if let navigation = controller as? UINavigationController {
            return topViewController(from: navigation.visibleViewController)
        }
        if let tabs = controller as? UITabBarController {
            return topViewController(from: tabs.selectedViewController)
        }
        return controller
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
