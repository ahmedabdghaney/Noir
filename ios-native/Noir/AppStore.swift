import Combine
import FirebaseFirestore
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
    private let databaseID = "ai-studio-d038e6e0-89a6-457a-a50e-97b6aadc9e67"
    private var authSubscription: AnyCancellable?
    private var watchlistListener: ListenerRegistration?
    private var continueListener: ListenerRegistration?
    private var cloudUserID: String?

    private lazy var database = Firestore.firestore(database: databaseID)

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

    func connectCloud(to authentication: AuthenticationStore) {
        guard authSubscription == nil else { return }
        authSubscription = authentication.$user
            .map { $0?.uid }
            .removeDuplicates()
            .sink { [weak self] userID in
                self?.switchCloudUser(to: userID)
            }
    }

    func toggleSaved(_ item: MediaItem) {
        let removing = isSaved(item)
        if removing { watchlist.removeAll { $0.identity == item.identity } }
        else { watchlist.insert(item, at: 0) }
        persist(watchlist, key: watchlistKey)

        guard let userID = cloudUserID else { return }
        Task {
            do {
                let document = database.collection("users").document(userID)
                    .collection("watchlist").document(item.identity)
                if removing {
                    try await document.delete()
                } else {
                    try await document.setData(watchlistData(for: item))
                }
            } catch {
                errorMessage = "Couldn’t update My List in the cloud."
            }
        }
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

        guard let userID = cloudUserID else { return }
        Task {
            do {
                let document = database.collection("users").document(userID)
                    .collection("continueWatching").document(item.identity)
                if position / duration >= 0.95 {
                    try await document.delete()
                } else {
                    try await document.setData(continueData(
                        for: item,
                        position: position,
                        duration: duration,
                        season: season,
                        episode: episode
                    ))
                }
            } catch {
                errorMessage = "Couldn’t sync your viewing progress."
            }
        }
    }

    func resumeItem(for item: MediaItem) -> ContinueItem? {
        continueWatching.first { $0.id == item.identity }
    }

    func removeFromContinueWatching(_ item: MediaItem) {
        continueWatching.removeAll { $0.id == item.identity }
        persist(continueWatching, key: continueKey)
        guard let userID = cloudUserID else { return }
        Task {
            try? await database.collection("users").document(userID)
                .collection("continueWatching").document(item.identity).delete()
        }
    }

    func clearContinueWatching() {
        let removedIDs = continueWatching.map(\.id)
        continueWatching.removeAll()
        persist(continueWatching, key: continueKey)
        guard let userID = cloudUserID else { return }
        Task {
            let batch = database.batch()
            for id in removedIDs {
                let document = database.collection("users").document(userID)
                    .collection("continueWatching").document(id)
                batch.deleteDocument(document)
            }
            try? await batch.commit()
        }
    }

    private func switchCloudUser(to userID: String?) {
        watchlistListener?.remove()
        continueListener?.remove()
        watchlistListener = nil
        continueListener = nil
        cloudUserID = userID
        guard let userID else { return }

        let user = database.collection("users").document(userID)
        watchlistListener = user.collection("watchlist").addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor in
                guard let self else { return }
                if error != nil {
                    self.errorMessage = "Couldn’t load My List from the cloud."
                    return
                }
                guard let documents = snapshot?.documents else { return }
                self.watchlist = documents.compactMap(Self.watchlistItem)
                    .sorted { Self.timestamp($0.1) > Self.timestamp($1.1) }
                    .map(\.0)
                self.persist(self.watchlist, key: self.watchlistKey)
            }
        }

        continueListener = user.collection("continueWatching").addSnapshotListener { [weak self] snapshot, error in
            Task { @MainActor in
                guard let self else { return }
                if error != nil {
                    self.errorMessage = "Couldn’t load Continue Watching from the cloud."
                    return
                }
                guard let documents = snapshot?.documents else { return }
                self.continueWatching = documents.compactMap(Self.continueItem)
                    .sorted { $0.updatedAt > $1.updatedAt }
                self.persist(self.continueWatching, key: self.continueKey)
            }
        }
    }

    private func watchlistData(for item: MediaItem) -> [String: Any] {
        [
            "id": item.id,
            "type": item.type.rawValue,
            "title": item.title,
            "poster": item.posterPath ?? "",
            "backdrop": item.backdropPath ?? "",
            "rating": item.rating,
            "year": item.year,
            "genres": [String](),
            "addedAt": FieldValue.serverTimestamp()
        ]
    }

    private func continueData(
        for item: MediaItem,
        position: Double,
        duration: Double,
        season: Int,
        episode: Int
    ) -> [String: Any] {
        [
            "id": item.id,
            "type": item.type.rawValue,
            "title": item.title,
            "poster": item.posterPath ?? "",
            "backdrop": item.backdropPath ?? "",
            "rating": item.rating,
            "year": item.year,
            "genres": [String](),
            "progress": min(max(position / duration * 100, 0), 100),
            "positionSeconds": position,
            "durationSeconds": duration,
            "season": season,
            "episode": episode,
            "updatedAt": FieldValue.serverTimestamp()
        ]
    }

    private static func watchlistItem(_ document: QueryDocumentSnapshot) -> (MediaItem, Any)? {
        let data = document.data()
        guard let item = mediaItem(from: data) else { return nil }
        return (item, data["addedAt"] as Any)
    }

    private static func continueItem(_ document: QueryDocumentSnapshot) -> ContinueItem? {
        let data = document.data()
        guard let media = mediaItem(from: data) else { return nil }
        let position = number(data["positionSeconds"])
        let duration = number(data["durationSeconds"])
        guard position > 0, duration > 0 else { return nil }
        return ContinueItem(
            media: media,
            position: position,
            duration: duration,
            season: max(integer(data["season"]), 1),
            episode: max(integer(data["episode"]), 1),
            updatedAt: (data["updatedAt"] as? Timestamp)?.dateValue() ?? .distantPast
        )
    }

    private static func mediaItem(from data: [String: Any]) -> MediaItem? {
        let id = integer(data["id"])
        guard id > 0,
              let typeValue = data["type"] as? String,
              let type = MediaType(rawValue: typeValue),
              let title = data["title"] as? String,
              !title.isEmpty else { return nil }
        return MediaItem(
            id: id,
            type: type,
            title: title,
            overview: "",
            posterPath: imagePath(data["poster"]),
            backdropPath: imagePath(data["backdrop"]),
            rating: number(data["rating"]),
            year: String(describing: data["year"] ?? ""),
            genreIDs: []
        )
    }

    private static func imagePath(_ value: Any?) -> String? {
        guard var path = value as? String, !path.isEmpty else { return nil }
        if let marker = path.range(of: "/t/p/"),
           let slash = path[marker.upperBound...].firstIndex(of: "/") {
            path = String(path[slash...])
        }
        return path
    }

    private static func integer(_ value: Any?) -> Int {
        (value as? NSNumber)?.intValue ?? Int(value as? String ?? "") ?? 0
    }

    private static func number(_ value: Any?) -> Double {
        (value as? NSNumber)?.doubleValue ?? Double(value as? String ?? "") ?? 0
    }

    private static func timestamp(_ value: Any?) -> Date {
        (value as? Timestamp)?.dateValue() ?? .distantPast
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
