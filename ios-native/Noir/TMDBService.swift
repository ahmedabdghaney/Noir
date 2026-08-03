import Foundation

actor TMDBService {
    static let shared = TMDBService()
    private let apiKey = "ba9b34ad730f140e4c7de6c7491d0a90"
    private let baseURL = URL(string: "https://api.themoviedb.org/3")!
    private let decoder = JSONDecoder()

    static func imageURL(path: String?, size: String) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        return URL(string: "https://image.tmdb.org/t/p/\(size)\(path)")
    }

    func home() async throws -> (hero: [MediaItem], sections: [MediaSection]) {
        async let trending = page(path: "/trending/all/week")
        async let nowPlaying = page(path: "/movie/now_playing", forcedType: .movie, extra: ["region": "US"])
        async let popularTV = page(path: "/tv/popular", forcedType: .tv)
        async let popularMovies = page(path: "/movie/popular", forcedType: .movie)
        async let upcoming = page(path: "/movie/upcoming", forcedType: .movie, extra: ["region": "US"])

        let values = try await (trending, nowPlaying, popularTV, popularMovies, upcoming)
        return (
            Array(values.0.prefix(7)),
            [
                MediaSection(id: "top-movies", title: "Top 10 Movies", items: Array(values.3.prefix(10))),
                MediaSection(id: "top-tv", title: "Top 10 TV Shows", items: Array(values.2.prefix(10))),
                MediaSection(id: "trending", title: "Trending This Week", items: values.0),
                MediaSection(id: "now-playing", title: "New Releases", items: values.1),
                MediaSection(id: "popular-tv", title: "Popular TV Shows", items: values.2),
                MediaSection(id: "popular-movies", title: "Popular Movies", items: values.3),
                MediaSection(id: "upcoming", title: "Coming Soon", items: values.4)
            ]
        )
    }

    func search(_ query: String) async throws -> [MediaItem] {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return [] }
        return try await page(path: "/search/multi", extra: ["query": query, "include_adult": "false"])
    }

    func details(for item: MediaItem) async throws -> MediaDetails {
        let dto: DetailsDTO = try await request(
            path: "/\(item.type.rawValue)/\(item.id)",
            parameters: ["append_to_response": "similar,credits,videos"]
        )
        let normalized = dto.asMediaItem(forcedType: item.type) ?? item
        return MediaDetails(
            item: normalized,
            tagline: dto.tagline ?? "",
            genres: dto.genres?.map(\.name) ?? [],
            runtime: dto.runtime ?? dto.episodeRunTime?.first,
            seasons: (dto.seasons ?? []).filter { $0.seasonNumber > 0 }.map {
                Season(id: $0.id, name: $0.name, number: $0.seasonNumber,
                       episodeCount: $0.episodeCount, posterPath: $0.posterPath)
            },
            similar: (dto.similar?.results ?? []).compactMap { $0.asMediaItem(forcedType: item.type) },
            cast: (dto.credits?.cast ?? []).prefix(16).map {
                CastPerson(id: $0.id, name: $0.name, character: $0.character ?? "",
                           profilePath: $0.profilePath)
            },
            trailers: (dto.videos?.results ?? []).filter {
                $0.site.caseInsensitiveCompare("YouTube") == .orderedSame &&
                ($0.type == "Trailer" || $0.type == "Teaser")
            }.prefix(8).map { TrailerClip(id: $0.id, name: $0.name, key: $0.key) }
        )
    }

    func episodes(showID: Int, season: Int) async throws -> [Episode] {
        let dto: SeasonDTO = try await request(path: "/tv/\(showID)/season/\(season)")
        return dto.episodes.map {
            Episode(id: $0.id, number: $0.episodeNumber, name: $0.name,
                    overview: $0.overview ?? "", runtime: $0.runtime, stillPath: $0.stillPath)
        }
    }

    private func page(path: String, forcedType: MediaType? = nil,
                      extra: [String: String] = [:]) async throws -> [MediaItem] {
        let response: PageDTO = try await request(path: path, parameters: extra)
        return response.results.compactMap { $0.asMediaItem(forcedType: forcedType) }
            .filter { item in
                guard item.posterPath != nil, let year = Int(item.year) else { return false }
                return year >= 1998
            }
    }

    private func request<T: Decodable>(path: String,
                                       parameters: [String: String] = [:]) async throws -> T {
        var components = URLComponents(url: baseURL.appending(path: path), resolvingAgainstBaseURL: false)!
        var query = [
            URLQueryItem(name: "api_key", value: apiKey),
            URLQueryItem(name: "language", value: "en-US")
        ]
        query.append(contentsOf: parameters.map { URLQueryItem(name: $0.key, value: $0.value) })
        components.queryItems = query
        guard let url = components.url else { throw URLError(.badURL) }
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try decoder.decode(T.self, from: data)
    }
}

private struct PageDTO: Decodable { let results: [MediaDTO] }

private struct MediaDTO: Decodable {
    let id: Int
    let mediaType: String?
    let title: String?
    let name: String?
    let originalTitle: String?
    let originalName: String?
    let overview: String?
    let posterPath: String?
    let backdropPath: String?
    let voteAverage: Double?
    let releaseDate: String?
    let firstAirDate: String?
    let genreIds: [Int]?

    enum CodingKeys: String, CodingKey {
        case id, title, name, overview
        case mediaType = "media_type"
        case originalTitle = "original_title"
        case originalName = "original_name"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case genreIds = "genre_ids"
    }

    func asMediaItem(forcedType: MediaType? = nil) -> MediaItem? {
        let resolved: MediaType
        if let forcedType { resolved = forcedType }
        else if mediaType == "tv" { resolved = .tv }
        else if mediaType == "movie" { resolved = .movie }
        else { return nil }
        // Prefer the localized English title returned for the en-US request.
        // Original titles can be Korean, Japanese, or another source language.
        let resolvedTitle = resolved == .tv
            ? (name ?? originalName ?? "Unknown")
            : (title ?? originalTitle ?? "Unknown")
        let date = resolved == .tv ? firstAirDate : releaseDate
        return MediaItem(id: id, type: resolved, title: resolvedTitle,
                         overview: overview ?? "", posterPath: posterPath,
                         backdropPath: backdropPath, rating: voteAverage ?? 0,
                         year: String((date ?? "").prefix(4)), genreIDs: genreIds ?? [])
    }
}

private struct DetailsDTO: Decodable {
    let id: Int
    let title: String?
    let name: String?
    let originalTitle: String?
    let originalName: String?
    let overview: String?
    let posterPath: String?
    let backdropPath: String?
    let voteAverage: Double?
    let releaseDate: String?
    let firstAirDate: String?
    let tagline: String?
    let runtime: Int?
    let episodeRunTime: [Int]?
    let genres: [GenreDTO]?
    let seasons: [SeasonSummaryDTO]?
    let similar: PageDTO?
    let credits: CreditsDTO?
    let videos: VideosDTO?

    enum CodingKeys: String, CodingKey {
        case id, title, name, overview, tagline, runtime, genres, seasons, similar, credits, videos
        case originalTitle = "original_title"
        case originalName = "original_name"
        case posterPath = "poster_path"
        case backdropPath = "backdrop_path"
        case voteAverage = "vote_average"
        case releaseDate = "release_date"
        case firstAirDate = "first_air_date"
        case episodeRunTime = "episode_run_time"
    }

    func asMediaItem(forcedType: MediaType) -> MediaItem? {
        MediaDTO(id: id, mediaType: forcedType.rawValue, title: title, name: name,
                 originalTitle: originalTitle, originalName: originalName, overview: overview,
                 posterPath: posterPath, backdropPath: backdropPath, voteAverage: voteAverage,
                 releaseDate: releaseDate, firstAirDate: firstAirDate, genreIds: genres?.map(\.id))
            .asMediaItem(forcedType: forcedType)
    }
}

private struct GenreDTO: Decodable { let id: Int; let name: String }
private struct CreditsDTO: Decodable { let cast: [CastDTO] }
private struct CastDTO: Decodable {
    let id: Int
    let name: String
    let character: String?
    let profilePath: String?
    enum CodingKeys: String, CodingKey { case id, name, character; case profilePath = "profile_path" }
}
private struct VideosDTO: Decodable { let results: [VideoDTO] }
private struct VideoDTO: Decodable { let id: String; let key: String; let name: String; let site: String; let type: String }

private struct SeasonSummaryDTO: Decodable {
    let id: Int
    let name: String
    let seasonNumber: Int
    let episodeCount: Int
    let posterPath: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case seasonNumber = "season_number"
        case episodeCount = "episode_count"
        case posterPath = "poster_path"
    }
}

private struct SeasonDTO: Decodable { let episodes: [EpisodeDTO] }
private struct EpisodeDTO: Decodable {
    let id: Int
    let episodeNumber: Int
    let name: String
    let overview: String?
    let runtime: Int?
    let stillPath: String?

    enum CodingKeys: String, CodingKey {
        case id, name, overview, runtime
        case episodeNumber = "episode_number"
        case stillPath = "still_path"
    }
}
