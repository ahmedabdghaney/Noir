import SwiftUI

struct SearchScreen: View {
    @EnvironmentObject private var store: AppStore
    @State private var query = ""
    @State private var results: [MediaItem] = []
    @State private var recentItems: [MediaItem] = []
    @State private var isSearching = false
    @State private var errorMessage: String?
    @FocusState private var searchIsFocused: Bool

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()

            VStack(spacing: 0) {
                AppPageHeader(title: "Search")

                Group {
                    if query.isEmpty {
                        if searchIsFocused && !recentItems.isEmpty {
                            recentSearches
                        } else {
                            browseGrid
                        }
                    } else if isSearching && results.isEmpty {
                        ProgressView()
                            .controlSize(.large)
                            .tint(Color.secondary)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if results.isEmpty {
                        ContentUnavailableView(
                            "No Results",
                            systemImage: "magnifyingglass",
                            description: Text(errorMessage ?? "Try another title")
                        )
                    } else {
                        resultList
                    }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .searchable(text: $query, prompt: "Movies and TV Shows")
        .searchFocused($searchIsFocused)
        .onSubmit(of: .search) {
            searchIsFocused = false
            Task { await performSearch(addToHistory: true) }
        }
        .task { await store.loadHome() }
        .task(id: query) {
            guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                results = []
                errorMessage = nil
                return
            }
            try? await Task.sleep(for: .milliseconds(320))
            guard !Task.isCancelled else { return }
            await performSearch(addToHistory: false)
        }
        .mediaDestinations()
    }

    private var browseGrid: some View {
        ScrollView {
            LazyVGrid(columns: browseColumns, spacing: 12) {
                ForEach(Array(browseItems.enumerated()), id: \.element.identity) { index, item in
                    NavigationLink(value: item) {
                        BrowseTile(item: item, title: browseTitles[index % browseTitles.count])
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, NoirDesign.horizontalPadding)
            .padding(.top, 22)
            .padding(.bottom, NoirDesign.Space.large)
        }
        .scrollIndicators(.hidden)
    }

    private var recentSearches: some View {
        ScrollView {
            VStack(spacing: 0) {
                HStack {
                    Text("Recently Searched")
                        .font(.headline)
                    Spacer()
                    Button("Clear") { recentItems.removeAll() }
                        .font(.body)
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
                .padding(.vertical, 10)

                Divider().padding(.leading, NoirDesign.horizontalPadding)

                ForEach(recentItems) { item in
                    SearchResultRow(item: item)
                }
            }
            .padding(.bottom, NoirDesign.Space.large)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
    }

    private var resultList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(results) { item in
                    SearchResultRow(item: item)
                }
            }
            .padding(.bottom, NoirDesign.Space.large)
        }
        .scrollDismissesKeyboard(.interactively)
        .scrollIndicators(.hidden)
    }

    private var browseColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 12), count: 3)
    }

    private var browseItems: [MediaItem] {
        let pool = store.heroItems + store.sections.flatMap(\.items)
        var seen = Set<String>()
        return Array(pool.filter { seen.insert($0.identity).inserted }.prefix(18))
    }

    private let browseTitles = [
        "Noir", "Movies", "TV Shows", "Free for Everyone", "Kids & Family",
        "Drama", "Comedy", "Horror", "Science Fiction", "Action", "Romance", "Animation"
    ]

    @MainActor
    private func performSearch(addToHistory: Bool) async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isSearching = true
        errorMessage = nil
        do {
            let found = try await TMDBService.shared.search(trimmed)
            guard query.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            results = found
            if addToHistory, let first = found.first {
                recentItems.removeAll { $0.identity == first.identity }
                recentItems.insert(first, at: 0)
                recentItems = Array(recentItems.prefix(8))
            }
        } catch {
            guard query.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed else { return }
            results = []
            errorMessage = "Search is temporarily unavailable."
        }
        if query.trimmingCharacters(in: .whitespacesAndNewlines) == trimmed { isSearching = false }
    }
}

private struct BrowseTile: View {
    let item: MediaItem
    let title: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            ArtworkView(url: item.posterURL)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
            LinearGradient(colors: [.clear, .black.opacity(0.68)], startPoint: .center, endPoint: .bottom)
            Text(title)
                .font(.headline.weight(.semibold))
                .lineLimit(2)
                .padding(10)
        }
        .aspectRatio(2 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.card, style: .continuous))
        .appleGlassCardRim(radius: NoirDesign.Radius.card)
    }
}

private struct SearchResultRow: View {
    let item: MediaItem

    var body: some View {
        NavigationLink(value: item) {
            HStack(spacing: 12) {
                ArtworkView(url: item.posterURL)
                    .frame(width: 48, height: 72)
                    .clipped()
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    Text(item.title)
                        .font(.body)
                        .foregroundStyle(.primary)
                        .lineLimit(2)
                    Text([item.type.displayName, item.year].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer(minLength: 8)

                Image(systemName: "ellipsis")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 4)
            }
            .padding(.horizontal, NoirDesign.horizontalPadding)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottomTrailing) {
            Divider().padding(.leading, 80)
        }
    }
}

struct WatchlistScreen: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()

            VStack(spacing: 0) {
                AppPageHeader(title: "My List")

                if store.watchlist.isEmpty {
                    ContentUnavailableView(
                        "Your List Is Empty",
                        systemImage: "bookmark",
                        description: Text("Add movies and TV shows to watch later")
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    ScrollView { MediaGrid(items: store.watchlist) }
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .mediaDestinations()
    }
}

struct CategoryScreen: View {
    let type: MediaType
    let title: String
    @EnvironmentObject private var store: AppStore

    private var items: [MediaItem] {
        var seen = Set<String>()
        return store.sections.flatMap(\.items).filter { $0.type == type && seen.insert($0.identity).inserted }
    }

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()

            VStack(spacing: 0) {
                AppPageHeader(title: title)

                if items.isEmpty && store.isLoading {
                    ProgressView()
                        .controlSize(.large)
                        .tint(Color.secondary)
                        .frame(maxHeight: .infinity)
                } else if items.isEmpty {
                    ContentUnavailableView(
                        "Nothing Here Yet",
                        systemImage: type == .movie ? "film" : "tv",
                        description: Text("Pull to refresh and try again")
                    )
                    .frame(maxHeight: .infinity)
                } else {
                    ScrollView { MediaGrid(items: items) }
                        .refreshable { await store.loadHome(force: true) }
                        .tint(Color.secondary)
                }
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task { await store.loadHome() }
        .mediaDestinations()
    }
}

struct SectionGridScreen: View {
    let title: String
    let items: [MediaItem]

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()
            ScrollView { MediaGrid(items: items) }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.large)
        .mediaDestinations()
    }
}

private struct AppPageHeader: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(.largeTitle.weight(.bold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer()
            Image("ProfileAvatar")
                .resizable()
                .scaledToFill()
                .frame(width: 40, height: 40)
                .clipShape(Circle())
                .accessibilityLabel("Profile")
        }
        .padding(.horizontal, NoirDesign.horizontalPadding)
        .padding(.top, -7)
        .padding(.bottom, 12)
    }
}

struct MediaGrid: View {
    let items: [MediaItem]
    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: 3)

    var body: some View {
        LazyVGrid(columns: columns, alignment: .center, spacing: 12) {
            ForEach(items) { item in
                NavigationLink(value: item) { PosterCard(item: item) }
                    .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, NoirDesign.horizontalPadding)
        .padding(.vertical, NoirDesign.Space.standard)
    }
}
