import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: NoirDesign.Space.section) {
                    if !store.heroItems.isEmpty {
                        HeroCarousel(items: store.heroItems)
                    }

                    if !store.continueWatching.isEmpty {
                        ContinueRow(items: store.continueWatching)
                    }

                    if let promotion = store.sections.first?.items.first {
                        FeatureCard(item: promotion)
                    }

                    ForEach(store.sections) { section in
                        MediaRow(section: section)
                    }
                }
                .padding(.bottom, NoirDesign.Space.large)
            }
            .scrollIndicators(.hidden)

            if store.isLoading && store.sections.isEmpty {
                ProgressView()
                    .controlSize(.large)
                    .tint(Color.secondary)
            }
        }
        .ignoresSafeArea(edges: .top)
        .task { await store.loadHome() }
        .alert("Unable to Load", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "Please try again.")
        }
        .mediaDestinations()
    }
}

struct HeroCarousel: View {
    let items: [MediaItem]
    @EnvironmentObject private var store: AppStore
    @State private var index = 0
    @State private var playerItem: MediaItem?

    private var item: MediaItem { items[min(index, items.count - 1)] }

    var body: some View {
        GeometryReader { proxy in
            let stretch = max(proxy.frame(in: .global).minY, 0)

            ZStack(alignment: .bottom) {
                ArtworkView(url: item.posterURL)
                    .frame(width: proxy.size.width, height: proxy.size.height + stretch)
                    .offset(y: -stretch)
                    .id(item.identity)
                    .transition(.opacity)
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)

                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.12), location: 0),
                        .init(color: .clear, location: 0.30),
                        .init(color: .black.opacity(0.22), location: 0.54),
                        .init(color: .black.opacity(0.86), location: 0.86),
                        .init(color: .black, location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: proxy.size.height + stretch)
                .offset(y: -stretch)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)

                VStack(spacing: 9) {
                    Spacer()

                    Text(item.title)
                        .font(.system(size: 27, weight: .bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.58)

                    Text(heroMetadata)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.78))
                        .lineLimit(1)

                    Text(item.overview.isEmpty ? "Discover this title on Noir." : item.overview)
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(2)
                        .lineSpacing(2)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 520)

                    HStack(spacing: 12) {
                        Button { playerItem = item } label: {
                            PrimaryActionLabel(title: "Play", systemImage: "play.fill")
                        }
                        .buttonStyle(.plain)

                        LibraryActionButton(isSaved: store.isSaved(item)) {
                            store.toggleSaved(item)
                        }
                    }

                    HStack(spacing: 6) {
                        ForEach(items.indices, id: \.self) { dot in
                            Capsule()
                                .fill(.white.opacity(dot == index ? 0.95 : 0.32))
                                .frame(width: dot == index ? 22 : 6, height: 6)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .animation(.smooth(duration: 0.28), value: index)
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
                .padding(.bottom, 18)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .contentShape(Rectangle())
            .simultaneousGesture(
                DragGesture(minimumDistance: 36).onEnded { value in
                    withAnimation(.easeInOut(duration: 0.34)) {
                        index = value.translation.width < 0
                            ? (index + 1) % items.count
                            : (index - 1 + items.count) % items.count
                    }
                }
            )
        }
        .frame(height: UIScreen.main.bounds.width * 4 / 3)
        .fullScreenCover(item: $playerItem) { SmartPlayerScreen(item: $0) }
    }

    private var heroMetadata: String {
        var values = [item.type.displayName]
        if !item.year.isEmpty { values.append(item.year) }
        if item.rating > 0 { values.append("★ \(item.rating.formatted(.number.precision(.fractionLength(1))))") }
        return values.joined(separator: "  ·  ")
    }
}

private struct FeatureCard: View {
    let item: MediaItem

    var body: some View {
        NavigationLink(value: item) {
            ZStack(alignment: .bottom) {
                ArtworkView(url: item.posterURL)
                    .frame(width: 390, height: 450)
                    .clipped()

                LinearGradient(
                    colors: [.clear, .black.opacity(0.12), .black.opacity(0.82)],
                    startPoint: .center,
                    endPoint: .bottom
                )

                VStack(spacing: 8) {
                    Text(item.title)
                        .font(.system(size: 31, weight: .bold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                    Text(item.overview)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.88))
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 18)
            }
            .frame(width: 390, height: 450)
            .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.largeCard, style: .continuous))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, NoirDesign.horizontalPadding)
    }
}

struct MediaRow: View {
    let section: MediaSection

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            NavigationLink {
                SectionGridScreen(title: sectionTitle, items: section.items)
            } label: {
                SectionHeader(title: sectionTitle)
            }
            .buttonStyle(.plain)

            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 12) {
                    ForEach(Array(section.items.enumerated()), id: \.element.identity) { rank, item in
                        NavigationLink(value: item) {
                            if section.id.hasPrefix("top-") {
                                RankedPosterCard(item: item, rank: rank + 1)
                            } else {
                                PosterCard(item: item)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var sectionTitle: String {
        switch section.id {
        case "top-movies": return "Top 10 Movies on Noir"
        case "top-tv": return "Top 10 TV Shows on Noir"
        case "now-playing": return "New Releases on Noir"
        default: return section.title
        }
    }
}

struct PosterCard: View {
    let item: MediaItem

    var body: some View {
        ArtworkView(url: item.posterURL)
            .frame(width: NoirDesign.posterWidth, height: NoirDesign.posterHeight)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.card, style: .continuous))
            .appleGlassCardRim(radius: NoirDesign.Radius.card)
            .contentShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.card, style: .continuous))
    }
}

struct RankedPosterCard: View {
    let item: MediaItem
    let rank: Int

    var body: some View {
        ZStack(alignment: .topLeading) {
            ArtworkView(url: item.posterURL)
                .frame(width: NoirDesign.posterWidth, height: NoirDesign.posterHeight)
                .clipped()

            LinearGradient(colors: [.black.opacity(0.28), .clear], startPoint: .top, endPoint: .center)

            Text("\(rank)")
                .font(.system(size: 30, weight: .bold))
                .foregroundStyle(.white)
                .padding(8)
        }
        .frame(width: NoirDesign.posterWidth, height: NoirDesign.posterHeight)
        .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.card, style: .continuous))
        .appleGlassCardRim(radius: NoirDesign.Radius.card)
    }
}

struct ContinueRow: View {
    let items: [ContinueItem]
    @EnvironmentObject private var store: AppStore
    @State private var playerRequest: PlayerRequest?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Continue Watching")

            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(items) { progress in
                        ZStack(alignment: .bottomTrailing) {
                            Button {
                                play(progress)
                            } label: {
                                ContinueCard(progress: progress)
                            }
                            .buttonStyle(.plain)

                            Menu {
                                Button {
                                    play(progress)
                                } label: {
                                    Label("Resume", systemImage: "play.fill")
                                }

                                NavigationLink(value: progress.media) {
                                    Label("View Details", systemImage: "info.circle")
                                }

                                Button(role: .destructive) {
                                    store.removeFromContinueWatching(progress.media)
                                } label: {
                                    Label("Remove from Continue Watching", systemImage: "minus.circle")
                                }
                            } label: {
                                Image(systemName: "ellipsis")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundStyle(.white.opacity(0.78))
                                    .frame(width: 44, height: 44)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .padding(.trailing, 2)
                            .padding(.bottom, 1)
                        }
                    }
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
            }
            .scrollIndicators(.hidden)
        }
        .fullScreenCover(item: $playerRequest) { request in
            SmartPlayerScreen(item: request.item, season: request.season, episode: request.episode)
        }
    }

    private func play(_ progress: ContinueItem) {
        playerRequest = PlayerRequest(
            item: progress.media,
            season: progress.season,
            episode: progress.episode
        )
    }
}

private struct ContinueCard: View {
    let progress: ContinueItem

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            ArtworkView(url: progress.media.backdropURL)
                .frame(width: NoirDesign.continueWidth, height: NoirDesign.continueHeight)
                .clipped()

            AppleCardBlur()

            HStack(spacing: 8) {
                Image(systemName: "play.fill")
                    .font(.caption.weight(.bold))
                ProgressView(value: progress.progress)
                    .tint(.white)
                    .frame(width: 44)
                Text(timeRemaining)
                    .font(.subheadline)
                Spacer()
                Color.clear.frame(width: 28, height: 1)
            }
            .padding(.horizontal, 14)
            .padding(.bottom, 13)
        }
        .frame(width: NoirDesign.continueWidth, height: NoirDesign.continueHeight)
        .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.largeCard, style: .continuous))
        .appleGlassCardRim(radius: NoirDesign.Radius.largeCard)
    }

    private var timeRemaining: String {
        let remaining = max(progress.duration - progress.position, 0)
        if remaining >= 3600 {
            let hours = Int(remaining / 3600)
            let minutes = Int(remaining.truncatingRemainder(dividingBy: 3600) / 60)
            return minutes > 0 ? "\(hours)h \(minutes)m" : "\(hours)h"
        }
        return "\(max(Int(remaining / 60), 1))m"
    }
}
