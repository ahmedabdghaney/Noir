import SwiftUI

enum AppTab: Hashable { case home, movies, shows, watchlist, search }

struct RootView: View {
    @State private var selection: AppTab
    private let debugDetailPreview: Bool
    private let debugPlayerPreview: Bool
    private let debugEpisodePreview: Bool

    init() {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        debugDetailPreview = arguments.contains("-NoirDetailPreview")
        debugPlayerPreview = arguments.contains("-NoirPlayerPreview")
        debugEpisodePreview = arguments.contains("-NoirEpisodePreview")
        if let marker = arguments.firstIndex(of: "-NoirTab"), arguments.indices.contains(marker + 1) {
            let value = arguments[marker + 1]
            let tab: AppTab = value == "search" ? .search : value == "movies" ? .movies : value == "shows" ? .shows : value == "watchlist" ? .watchlist : .home
            _selection = State(initialValue: tab)
        } else {
            _selection = State(initialValue: .home)
        }
        #else
        debugDetailPreview = false
        debugPlayerPreview = false
        debugEpisodePreview = false
        _selection = State(initialValue: .home)
        #endif
    }

    @ViewBuilder
    var body: some View {
        if debugEpisodePreview {
            EpisodeCardPreview()
        } else if debugPlayerPreview {
            SmartPlayerScreen(item: MediaItem(
                id: 94997,
                type: .tv,
                title: "House of the Dragon",
                overview: "The Targaryen dynasty is at the absolute apex of its power.",
                posterPath: nil,
                backdropPath: nil,
                rating: 8.3,
                year: "2022",
                genreIDs: []
            ))
        } else if debugDetailPreview {
            NavigationStack {
                DetailScreen(item: MediaItem(
                    id: 94997,
                    type: .tv,
                    title: "House of the Dragon",
                    overview: "The Targaryen dynasty is at the absolute apex of its power.",
                    posterPath: nil,
                    backdropPath: nil,
                    rating: 8.3,
                    year: "2022",
                    genreIDs: []
                ))
            }
        } else {
            if #available(iOS 26.0, *) {
                tabs.tabBarMinimizeBehavior(.onScrollDown)
            } else {
                tabs
            }
        }
    }

    private var tabs: some View {
        TabView(selection: $selection) {
            Tab("Home", systemImage: "house", value: .home) {
                NavigationStack { HomeView() }
            }
            Tab("Movies", systemImage: "film", value: .movies) {
                NavigationStack { CategoryScreen(type: .movie, title: "Movies") }
            }
            Tab("TV Shows", systemImage: "tv", value: .shows) {
                NavigationStack { CategoryScreen(type: .tv, title: "TV Shows") }
            }
            Tab("My List", systemImage: "bookmark", value: .watchlist) {
                NavigationStack { WatchlistScreen() }
            }
            Tab(value: .search, role: .search) {
                NavigationStack { SearchScreen() }
            }
        }
        .tint(.blue)
    }
}

struct MediaDestinationModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.navigationDestination(for: MediaItem.self) { DetailScreen(item: $0) }
    }
}

extension View {
    func mediaDestinations() -> some View { modifier(MediaDestinationModifier()) }
}
