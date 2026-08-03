import SwiftUI

struct DetailScreen: View {
    let item: MediaItem

    @EnvironmentObject private var store: AppStore
    @Environment(\.openURL) private var openURL
    @State private var details: MediaDetails?
    @State private var episodes: [Episode] = []
    @State private var selectedSeason = 1
    @State private var playerRequest: PlayerRequest?
    @State private var isLoadingDetails = true
    @State private var isLoadingEpisodes = false

    private var displayItem: MediaItem { details?.item ?? item }

    var body: some View {
        ZStack(alignment: .top) {
            NoirDesign.background.ignoresSafeArea()

            ScrollView {
                LazyVStack(spacing: 38) {
                    detailHero

                    if item.type == .tv { episodesSection }

                    if let trailers = details?.trailers, !trailers.isEmpty {
                        trailersSection(trailers)
                    }

                    if let similar = details?.similar, !similar.isEmpty {
                        MediaRow(section: MediaSection(id: "related", title: "Related", items: similar))
                    }

                    howToWatchSection

                    if let cast = details?.cast, !cast.isEmpty { castSection(cast) }

                    informationSection
                    languagesSection
                    accessibilitySection
                }
                .padding(.bottom, NoirDesign.Space.large)
            }
            .scrollIndicators(.hidden)
        }
        .ignoresSafeArea(edges: .top)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                ShareLink(item: URL(string: "https://noir.aswad-iq.com")!) {
                    Image(systemName: "square.and.arrow.up")
                }
                .accessibilityLabel("Share")
            }
        }
        .task { await loadDetails() }
        .fullScreenCover(item: $playerRequest) { request in
            SmartPlayerScreen(item: request.item, season: request.season, episode: request.episode)
        }
    }

    private var detailHero: some View {
        GeometryReader { proxy in
            let stretch = max(proxy.frame(in: .global).minY, 0)

            ZStack(alignment: .bottom) {
                ArtworkView(url: displayItem.posterURL)
                    .frame(width: proxy.size.width, height: proxy.size.height + stretch)
                    .offset(y: -stretch)
                    .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)

                LinearGradient(
                    stops: [
                        .init(color: .black.opacity(0.05), location: 0),
                        .init(color: .clear, location: 0.40),
                        .init(color: .black.opacity(0.18), location: 0.58),
                        .init(color: .black.opacity(0.88), location: 0.86),
                        .init(color: .black, location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: proxy.size.height + stretch)
                .offset(y: -stretch)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)

                VStack(spacing: 10) {
                    Spacer()

                    Text(displayItem.title)
                        .font(.system(size: 27, weight: .bold))
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .minimumScaleFactor(0.72)

                    Text(primaryMetadata)
                        .font(.body)
                        .foregroundStyle(.white.opacity(0.88))
                        .lineLimit(1)

                    HStack(spacing: 12) {
                        Button { playDefault() } label: {
                            PrimaryActionLabel(
                                title: store.resumeItem(for: item) == nil ? "Play" : "Continue",
                                systemImage: "play.fill"
                            )
                        }
                        .buttonStyle(.plain)

                        LibraryActionButton(isSaved: store.isSaved(item)) {
                            store.toggleSaved(item)
                        }
                    }

                    Text(displayItem.overview.isEmpty ? "No description is available for this title." : displayItem.overview)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(3)
                        .lineSpacing(2)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 560)

                    Text(secondaryMetadata)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.70))
                        .lineLimit(1)
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
                .padding(.bottom, 20)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
        .frame(height: 680)
        .overlay {
            if isLoadingDetails {
                ProgressView()
                    .controlSize(.large)
                    .tint(Color.secondary)
                    .allowsHitTesting(false)
            }
        }
    }

    private var episodesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Menu {
                ForEach(details?.seasons ?? []) { season in
                    Button {
                        selectedSeason = season.number
                    } label: {
                        if season.number == selectedSeason { Label(season.name, systemImage: "checkmark") }
                        else { Text(season.name) }
                    }
                }
            } label: {
                HStack(spacing: 5) {
                    Text(selectedSeasonName).font(.title2.weight(.bold))
                    Image(systemName: "chevron.right").font(.headline.weight(.bold)).foregroundStyle(.tertiary)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, NoirDesign.horizontalPadding)

            if isLoadingEpisodes {
                ProgressView()
                    .tint(Color.secondary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 278)
            } else {
                ScrollView(.horizontal) {
                    LazyHStack(spacing: 12) {
                        ForEach(episodes) { episode in
                            Button { playEpisode(episode.number) } label: { EpisodeCard(episode: episode) }
                                .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, NoirDesign.horizontalPadding)
                }
                .scrollIndicators(.hidden)
            }
        }
        .onChange(of: selectedSeason) { _, season in Task { await loadEpisodes(season) } }
    }

    private func trailersSection(_ trailers: [TrailerClip]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Trailers")
            ScrollView(.horizontal) {
                LazyHStack(spacing: 12) {
                    ForEach(trailers) { trailer in
                        Button { if let url = trailer.youtubeURL { openURL(url) } } label: {
                            TrailerCard(trailer: trailer)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var howToWatchSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "How to Watch", showsChevron: false)
            Button { playDefault() } label: {
                HStack(spacing: 14) {
                    Image(systemName: "play.tv.fill")
                        .font(.title2)
                        .frame(width: 62, height: 62)
                        .background(.black.opacity(0.35), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Watch on Noir").font(.headline)
                        Text("Available now").font(.subheadline).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "play.fill").foregroundStyle(.secondary)
                }
                .padding(12)
                .background(NoirDesign.secondaryBackground, in: RoundedRectangle(cornerRadius: NoirDesign.Radius.largeCard, style: .continuous))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, NoirDesign.horizontalPadding)
        }
    }

    private var informationSection: some View {
        DetailTextSection(title: "Information") {
            DetailFact(label: "Type", value: item.type.displayName)
            if !displayItem.year.isEmpty { DetailFact(label: "Released", value: displayItem.year) }
            if let runtime = details?.runtime { DetailFact(label: "Run Time", value: durationText(runtime)) }
            if let genres = details?.genres, !genres.isEmpty { DetailFact(label: "Genres", value: genres.joined(separator: ", ")) }
        }
    }

    private var languagesSection: some View {
        DetailTextSection(title: "Languages") {
            DetailFact(label: "Original Audio", value: "English")
            DetailFact(label: "Audio & Subtitles", value: "English (United States)")
        }
    }

    private var accessibilitySection: some View {
        DetailTextSection(title: "Accessibility") {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: "captions.bubble")
                    .font(.title3)
                Text("Closed captions include dialogue and relevant non-dialogue information when available.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func castSection(_ cast: [CastPerson]) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Cast & Crew")
            ScrollView(.horizontal) {
                LazyHStack(alignment: .top, spacing: 16) {
                    ForEach(cast) { person in
                        VStack(spacing: 8) {
                            ArtworkView(url: person.profileURL)
                                .frame(width: 88, height: 88)
                                .clipped()
                                .clipShape(Circle())
                            Text(person.name).font(.caption.weight(.semibold)).lineLimit(1)
                            Text(person.character).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                        .frame(width: 96)
                    }
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
            }
            .scrollIndicators(.hidden)
        }
    }

    private var primaryMetadata: String {
        var values = [item.type.displayName]
        if let genres = details?.genres, !genres.isEmpty { values.append(contentsOf: genres.prefix(2)) }
        return values.joined(separator: " · ")
    }

    private var secondaryMetadata: String {
        var values: [String] = []
        if !displayItem.year.isEmpty { values.append(displayItem.year) }
        if let runtime = details?.runtime { values.append(durationText(runtime)) }
        if displayItem.rating > 0 { values.append("★ \(displayItem.rating.formatted(.number.precision(.fractionLength(1))))") }
        values.append("HD")
        values.append("CC")
        return values.joined(separator: " · ")
    }

    private var selectedSeasonName: String {
        details?.seasons.first(where: { $0.number == selectedSeason })?.name ?? "Season \(selectedSeason)"
    }

    private func durationText(_ minutes: Int) -> String {
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours == 0 { return "\(minutes) min" }
        return remainder == 0 ? "\(hours) hr" : "\(hours) hr \(remainder) min"
    }

    private func loadDetails() async {
        isLoadingDetails = true
        details = try? await TMDBService.shared.details(for: item)
        isLoadingDetails = false
        if item.type == .tv {
            let firstSeason = details?.seasons.first?.number ?? 1
            if selectedSeason == firstSeason { await loadEpisodes(firstSeason) }
            else { selectedSeason = firstSeason }
        }
    }

    private func loadEpisodes(_ season: Int) async {
        isLoadingEpisodes = true
        let loaded = try? await TMDBService.shared.episodes(showID: item.id, season: season)
        guard selectedSeason == season else { return }
        episodes = loaded ?? []
        isLoadingEpisodes = false
    }

    private func playDefault() {
        if let saved = store.resumeItem(for: item) {
            playerRequest = PlayerRequest(item: item, season: saved.season, episode: saved.episode)
        } else {
            playerRequest = PlayerRequest(item: item, season: selectedSeason, episode: 1)
        }
    }

    private func playEpisode(_ episode: Int) {
        playerRequest = PlayerRequest(item: item, season: selectedSeason, episode: episode)
    }
}

private struct DetailTextSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(title).font(.title2.weight(.bold))
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, NoirDesign.horizontalPadding)
    }
}

private struct DetailFact: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.subheadline).foregroundStyle(.primary)
            Text(value).font(.subheadline).foregroundStyle(.secondary)
        }
    }
}

private struct EpisodeCard: View {
    let episode: Episode

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            ArtworkView(url: episode.stillURL)
                .frame(width: 270, height: 278)
                .clipped()

            AppleCardBlur()

            VStack(alignment: .leading, spacing: 6) {
                Text("EPISODE \(episode.number)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.78))

                Text(episode.name)
                    .font(.headline)
                    .lineLimit(1)

                if !episode.overview.isEmpty {
                    Text(episode.overview)
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.76))
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 6) {
                    Image(systemName: "play.fill")
                    Capsule()
                        .fill(.white.opacity(0.28))
                        .frame(width: 24, height: 3)
                    Text(episode.runtime.map { "\($0)m" } ?? "Play")
                    Spacer()
                    Image(systemName: "ellipsis")
                }
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.76))
            }
            .frame(width: 242, alignment: .leading)
            .padding(14)
        }
        .frame(width: 270, height: 278)
        .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.largeCard, style: .continuous))
        .appleGlassCardRim(radius: NoirDesign.Radius.largeCard)
    }
}

#if DEBUG
struct EpisodeCardPreview: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            ScrollView(.horizontal) {
                HStack(spacing: 12) {
                    EpisodeCard(episode: Episode(
                        id: 1,
                        number: 1,
                        name: "Freedom Day",
                        overview: "Sheriff Becker’s plans for the future are thrown off course after his wife meets a hacker with information about the silo.",
                        runtime: 60,
                        stillPath: "/1N7eZfud7nsg8Ah1b3FWhrG1W5t.jpg"
                    ))
                    EpisodeCard(episode: Episode(
                        id: 2,
                        number: 2,
                        name: "Holston’s Pick",
                        overview: "Juliette, an engineer, pieces together what might have led to a mysterious death.",
                        runtime: 47,
                        stillPath: "/e4S3m9tjk1aL7T1zTeM2SrDbXBy.jpg"
                    ))
                }
                .padding(.horizontal, NoirDesign.horizontalPadding)
            }
            .scrollIndicators(.hidden)
        }
    }
}
#endif

private struct TrailerCard: View {
    let trailer: TrailerClip

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            ArtworkView(url: trailer.thumbnailURL)
                .frame(width: 270, height: 186)
                .clipped()
            AppleCardBlur()
            VStack(alignment: .leading, spacing: 6) {
                Text(trailer.name).font(.headline).lineLimit(2)
                Label("Trailer", systemImage: "play.fill")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.76))
            }
            .frame(width: 242, alignment: .leading)
            .padding(14)
        }
        .frame(width: 270, height: 186)
        .clipShape(RoundedRectangle(cornerRadius: NoirDesign.Radius.largeCard, style: .continuous))
        .appleGlassCardRim(radius: NoirDesign.Radius.largeCard)
    }
}

struct PlayerRequest: Identifiable {
    let item: MediaItem
    let season: Int
    let episode: Int
    var id: String { "\(item.identity)_\(season)_\(episode)" }
}
