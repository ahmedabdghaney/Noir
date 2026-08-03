import AVKit
import SwiftUI
import WebKit

struct SmartPlayerScreen: View {
    let item: MediaItem
    var season: Int = 1
    var episode: Int = 1

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AppStore
    @State private var source: PlayerSource = .checking
    @State private var player: AVPlayer?
    @State private var progressTask: Task<Void, Never>?
    @State private var orientationTask: Task<Void, Never>?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            switch source {
            case .checking:
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)

            case .native:
                if let player {
                    SystemVideoPlayer(player: player)
                        .ignoresSafeArea()
                }

            case .vidAPI(let url):
                WebPlayer(url: url)
                    .ignoresSafeArea()

            case .failed:
                ContentUnavailableView {
                    Label("Unable to Play", systemImage: "exclamationmark.triangle")
                } description: {
                    Text("This title is temporarily unavailable. Please try again later.")
                } actions: {
                    Button("Try Again") {
                        source = .checking
                        Task { await resolveSource() }
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .task { await resolveSource() }
        .onAppear { enforceLandscape() }
        .onDisappear {
            saveProgress()
            player?.pause()
            progressTask?.cancel()
            orientationTask?.cancel()
            PlayerOrientation.request(.portrait)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 24, coordinateSpace: .global)
                .onEnded { value in
                    let isEdgeSwipe = value.startLocation.x <= 28
                    let isHorizontal = abs(value.translation.width) > abs(value.translation.height)
                    if isEdgeSwipe, isHorizontal, value.translation.width > 90 {
                        dismiss()
                    }
                }
        )
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
    }

    private func enforceLandscape() {
        orientationTask?.cancel()
        orientationTask = Task { @MainActor in
            PlayerOrientation.request(.landscape)
            try? await Task.sleep(for: .milliseconds(240))
            guard !Task.isCancelled else { return }
            PlayerOrientation.request(.landscape)
            try? await Task.sleep(for: .milliseconds(760))
            guard !Task.isCancelled else { return }
            PlayerOrientation.request(.landscape)
        }
    }

    @MainActor
    private func resolveSource() async {
        let directURL = mp4URL

        if await mediaExists(at: directURL) {
            configurePlayer(directURL)
            source = .native
        } else if let fallback = vidAPIURL {
            source = .vidAPI(fallback)
        } else {
            source = .failed
        }
    }

    private var mp4URL: URL {
        URL(string: "https://d269k7J205s3hx.cloudfront.net/" + encodedMediaPath(extension: "mp4"))!
    }

    private func encodedMediaPath(extension fileExtension: String) -> String {
        let invalidPathCharacters = CharacterSet(charactersIn: ":/\\?#%\"<>|")
        let safeTitle = item.title
            .components(separatedBy: invalidPathCharacters)
            .joined()
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let path: String
        if item.type == .tv {
            path = "TV/\(safeTitle)/\(item.id)/Season \(season)/\(episode).\(fileExtension)"
        } else {
            path = "Movies/\(safeTitle)/movie_\(item.id).\(fileExtension)"
        }

        return path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? path
    }

    private var vidAPIURL: URL? {
        var components = URLComponents(string: item.type == .tv
            ? "https://vidapi.qzz.io/tv/\(item.id)/\(season)/\(episode)"
            : "https://vidapi.qzz.io/movie/\(item.id)")
        components?.queryItems = [
            URLQueryItem(name: "primaryColor", value: "FFFFFF"),
            URLQueryItem(name: "secondaryColor", value: "8E8E93"),
            URLQueryItem(name: "iconColor", value: "FFFFFF"),
            URLQueryItem(name: "icons", value: "default"),
            URLQueryItem(name: "player", value: "nf"),
            URLQueryItem(name: "title", value: "true"),
            URLQueryItem(name: "poster", value: "true"),
            URLQueryItem(name: "autoplay", value: "true"),
            URLQueryItem(name: "nextbutton", value: item.type == .tv ? "true" : "false")
        ]
        return components?.url
    }

    private func mediaExists(at url: URL) async -> Bool {
        var head = URLRequest(url: url, timeoutInterval: 8)
        head.httpMethod = "HEAD"
        head.cachePolicy = .reloadIgnoringLocalCacheData

        do {
            let (_, response) = try await URLSession.shared.data(for: head)
            if let http = response as? HTTPURLResponse, (200..<400).contains(http.statusCode) {
                return true
            }
        } catch {
            // Some media origins reject HEAD requests, so verify a byte range below.
        }

        var range = URLRequest(url: url, timeoutInterval: 10)
        range.setValue("bytes=0-1", forHTTPHeaderField: "Range")
        range.cachePolicy = .reloadIgnoringLocalCacheData

        do {
            // Read the response as a stream so an origin that ignores Range
            // cannot make the app download an entire movie during preflight.
            let (_, response) = try await URLSession.shared.bytes(for: range)
            guard let http = response as? HTTPURLResponse else { return false }
            return http.statusCode == 200 || http.statusCode == 206
        } catch {
            return false
        }
    }

    @MainActor
    private func configurePlayer(_ url: URL) {
        guard player == nil else { return }

        let playerItem = AVPlayerItem(url: url)
        let created = AVPlayer(playerItem: playerItem)
        created.automaticallyWaitsToMinimizeStalling = true
        created.appliesMediaSelectionCriteriaAutomatically = true

        if let saved = store.resumeItem(for: item), saved.position > 5 {
            created.seek(
                to: CMTime(seconds: saved.position, preferredTimescale: 600),
                toleranceBefore: .zero,
                toleranceAfter: .zero
            )
        }

        player = created
        created.play()

        progressTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                guard !Task.isCancelled else { break }
                await MainActor.run { saveProgress() }
            }
        }
    }

    @MainActor
    private func saveProgress() {
        guard let player else { return }
        let position = player.currentTime().seconds
        let duration = player.currentItem?.duration.seconds ?? 0

        if position.isFinite, duration.isFinite {
            store.updateProgress(
                for: item,
                position: position,
                duration: duration,
                season: season,
                episode: episode
            )
        }
    }

}

@MainActor
private enum PlayerOrientation {
    static func request(_ orientations: UIInterfaceOrientationMask) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
        scene.windows.forEach { $0.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations() }
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientations)) { _ in }
    }
}

private enum PlayerSource {
    case checking
    case native
    case vidAPI(URL)
    case failed
}

private struct SystemVideoPlayer: UIViewControllerRepresentable {
    let player: AVPlayer

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.showsPlaybackControls = true
        controller.videoGravity = .resizeAspect
        controller.allowsPictureInPicturePlayback = true
        controller.canStartPictureInPictureAutomaticallyFromInline = true
        controller.updatesNowPlayingInfoCenter = true
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player {
            controller.player = player
        }
    }

    static func dismantleUIViewController(_ controller: AVPlayerViewController, coordinator: Void) {
        controller.player?.pause()
        controller.player = nil
    }
}

private struct WebPlayer: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.bootstrapScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if webView.url != url {
            webView.load(URLRequest(url: url, cachePolicy: .reloadRevalidatingCacheData))
        }
    }

    private static let bootstrapScript = """
    (function() {
      if (window.__noirPlayerLayoutInstalled) return;
      window.__noirPlayerLayoutInstalled = true;

      document.documentElement.style.cssText += ';margin:0;width:100%;height:100%;overflow:hidden;background:#000';
      if (document.body) document.body.style.cssText += ';margin:0;width:100%;height:100%;overflow:hidden;background:#000';

      var fullscreenStyle = document.getElementById('noir-inline-player-style');
      if (!fullscreenStyle) {
        fullscreenStyle = document.createElement('style');
        fullscreenStyle.id = 'noir-inline-player-style';
        fullscreenStyle.textContent = `
          [data-plyr="fullscreen"],
          .vjs-fullscreen-control,
          .jw-icon-fullscreen,
          .jw-icon-fullscreen-off,
          button[aria-label*="fullscreen" i],
          button[title*="fullscreen" i],
          button[aria-label*="full screen" i],
          button[title*="full screen" i],
          button[aria-label*="تكبير"],
          button[title*="تكبير"],
          button[aria-label*="ملء الشاشة"],
          button[title*="ملء الشاشة"] {
            display: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(fullscreenStyle);
      }

      function isFullscreenControl(element) {
        if (!element || !element.closest) return false;
        var control = element.closest('button,[role="button"],[data-plyr]');
        if (!control) return false;
        var label = [
          control.getAttribute('aria-label'),
          control.getAttribute('title'),
          control.getAttribute('data-plyr'),
          control.className,
          control.textContent
        ].filter(Boolean).join(' ').toLowerCase();
        return label.indexOf('fullscreen') >= 0 ||
          label.indexOf('full screen') >= 0 ||
          label.indexOf('تكبير') >= 0 ||
          label.indexOf('ملء الشاشة') >= 0;
      }

      document.addEventListener('click', function(event) {
        if (!isFullscreenControl(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }, true);

      function disableNativeFullscreen() {
        var resolved = function() { return Promise.resolve(); };
        try { Element.prototype.requestFullscreen = resolved; } catch (_) {}
        try { Element.prototype.webkitRequestFullscreen = resolved; } catch (_) {}
        try { Element.prototype.webkitRequestFullScreen = resolved; } catch (_) {}
        try { HTMLVideoElement.prototype.webkitEnterFullscreen = function() {}; } catch (_) {}
      }

      function styleMedia() {
        document.querySelectorAll('iframe,video').forEach(function(el) {
          el.style.width = '100vw';
          el.style.height = '100vh';
          el.style.maxWidth = 'none';
          el.style.maxHeight = 'none';
          el.style.objectFit = 'contain';

          if (el.tagName === 'VIDEO') {
            el.setAttribute('playsinline', '');
            el.setAttribute('webkit-playsinline', '');
            el.playsInline = true;
          }
        });
      }

      disableNativeFullscreen();
      styleMedia();
      new MutationObserver(function() {
        disableNativeFullscreen();
        styleMedia();
      }).observe(document.documentElement, { childList: true, subtree: true });
    })();
    """
}
