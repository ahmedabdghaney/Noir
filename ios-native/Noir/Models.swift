import Foundation

enum MediaType: String, Codable, Hashable, Sendable {
    case movie
    case tv

    var displayName: String { self == .movie ? "Movie" : "TV Show" }
}

struct MediaItem: Identifiable, Codable, Hashable, Sendable {
    let id: Int
    let type: MediaType
    let title: String
    let overview: String
    let posterPath: String?
    let backdropPath: String?
    let rating: Double
    let year: String
    let genreIDs: [Int]

    var identity: String { "\(type.rawValue)_\(id)" }
    var posterURL: URL? { TMDBService.imageURL(path: posterPath, size: "w780") }
    var backdropURL: URL? { TMDBService.imageURL(path: backdropPath, size: "original") }
}

struct MediaSection: Identifiable, Sendable {
    let id: String
    let title: String
    let items: [MediaItem]
}

struct MediaDetails: Sendable {
    let item: MediaItem
    let tagline: String
    let genres: [String]
    let runtime: Int?
    let seasons: [Season]
    let similar: [MediaItem]
    let cast: [CastPerson]
    let trailers: [TrailerClip]
}

struct CastPerson: Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let character: String
    let profilePath: String?

    var profileURL: URL? { TMDBService.imageURL(path: profilePath, size: "w342") }
}

struct TrailerClip: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let key: String

    var thumbnailURL: URL? { URL(string: "https://i.ytimg.com/vi/\(key)/hqdefault.jpg") }
    var youtubeURL: URL? { URL(string: "https://www.youtube.com/watch?v=\(key)") }
}

struct Season: Identifiable, Hashable, Sendable {
    let id: Int
    let name: String
    let number: Int
    let episodeCount: Int
    let posterPath: String?
}

struct Episode: Identifiable, Hashable, Sendable {
    let id: Int
    let number: Int
    let name: String
    let overview: String
    let runtime: Int?
    let stillPath: String?

    var stillURL: URL? { TMDBService.imageURL(path: stillPath, size: "original") }
}

struct ContinueItem: Identifiable, Codable, Hashable {
    let media: MediaItem
    var position: Double
    var duration: Double
    var season: Int
    var episode: Int
    var updatedAt: Date

    var id: String { media.identity }
    var progress: Double { duration > 0 ? min(max(position / duration, 0), 1) : 0 }
}
