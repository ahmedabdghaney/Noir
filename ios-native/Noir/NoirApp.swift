import SwiftUI

@main
struct NoirApp: App {
    @StateObject private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .preferredColorScheme(.dark)
                .environment(\.layoutDirection, .leftToRight)
        }
    }
}
