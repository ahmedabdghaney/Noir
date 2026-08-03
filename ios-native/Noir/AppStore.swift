import Foundation

@MainActor
final class AppStore: ObservableObject {
    @Published private(set) var heroItems: [MediaItem] = []
    @Published private(set) var sections: [MediaSection] = []
    @Published private(set) var watchlist: [MediaItem] = []
    @Published private(set) var continueWatching: [ContinueItem] = []
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let watchlistKey = "noir.ios.watchlist"
    private let continueKey = "noir.ios.continue"

    init() {
        watchlist = Self.decode([MediaItem].self, key: watchlistKey) ?? []
        continueWatching = Self.decode([ContinueItem].self, key: continueKey) ?? []
    }

    func loadHome(force: Bool = false) async {
        guard force || sections.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        do {
            let data = try await TMDBService.shared.home()
            heroItems = data.hero
            sections = data.sections
        } catch {
            errorMessage = "Unable to load content. Check your internet connection."
        }
        isLoading = false
    }

    func isSaved(_ item: MediaItem) -> Bool { watchlist.contains { $0.identity == item.identity } }

    func toggleSaved(_ item: MediaItem) {
        if isSaved(item) { watchlist.removeAll { $0.identity == item.identity } }
        else { watchlist.insert(item, at: 0) }
        persist(watchlist, key: watchlistKey)
    }

    func updateProgress(for item: MediaItem, position: Double, duration: Double,
                        season: Int = 1, episode: Int = 1) {
        guard duration > 0, position > 5 else { return }
        continueWatching.removeAll { $0.id == item.identity }
        if position / duration < 0.95 {
            continueWatching.insert(
                ContinueItem(media: item, position: position, duration: duration,
                             season: season, episode: episode, updatedAt: Date()), at: 0
            )
        }
        persist(continueWatching, key: continueKey)
    }

    func resumeItem(for item: MediaItem) -> ContinueItem? {
        continueWatching.first { $0.id == item.identity }
    }

    func removeFromContinueWatching(_ item: MediaItem) {
        continueWatching.removeAll { $0.id == item.identity }
        persist(continueWatching, key: continueKey)
    }

    private func persist<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    private static func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
