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
    @State private var isClosing = false

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
                    SystemVideoPlayer(player: player, subtitleURL: vttURL)
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

            if isClosing {
                Color.black
                    .ignoresSafeArea()
                    .transition(.opacity)
                    .zIndex(20)
            }
        }
        .task { await resolveSource() }
        .onAppear {
            configurePlaybackAudio()
            enforceLandscape()
        }
        .onDisappear {
            saveProgress()
            player?.pause()
            progressTask?.cancel()
            AppOrientation.request(.portrait)
        }
        .simultaneousGesture(
            DragGesture(minimumDistance: 24, coordinateSpace: .global)
                .onEnded { value in
                    let isEdgeSwipe = value.startLocation.x <= 28
                    let isHorizontal = abs(value.translation.width) > abs(value.translation.height)
                    if isEdgeSwipe, isHorizontal, value.translation.width > 90 {
                        closePlayer()
                    }
                }
        )
        .interactiveDismissDisabled(true)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
    }

    private func enforceLandscape() {
        // A single geometry request is enough. Repeating it while Rotation Lock
        // is enabled can make UIKit alternate between portrait and landscape.
        AppOrientation.request(.landscape)
    }

    private func configurePlaybackAudio() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .moviePlayback)
            try session.setActive(true)
        } catch {
            // AVPlayer can still attempt playback if the audio session is busy.
        }
    }

    private func closePlayer() {
        guard !isClosing else { return }
        saveProgress()
        player?.pause()
        progressTask?.cancel()
        withAnimation(.easeOut(duration: 0.12)) {
            isClosing = true
        }
        AppOrientation.request(.portrait)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
            dismiss()
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

    private var vttURL: URL {
        URL(string: "https://d269k7J205s3hx.cloudfront.net/" + encodedMediaPath(extension: "vtt"))!
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
        created.isMuted = false
        created.volume = 1
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

private enum PlayerSource {
    case checking
    case native
    case vidAPI(URL)
    case failed
}

private struct SystemVideoPlayer: UIViewControllerRepresentable {
    let player: AVPlayer
    let subtitleURL: URL

    func makeCoordinator() -> Coordinator {
        Coordinator(player: player, subtitleURL: subtitleURL)
    }

    func makeUIViewController(context: Context) -> AVPlayerViewController {
        let controller = AVPlayerViewController()
        controller.player = player
        controller.showsPlaybackControls = true
        controller.videoGravity = .resizeAspect
        controller.allowsPictureInPicturePlayback = true
        controller.canStartPictureInPictureAutomaticallyFromInline = true
        controller.updatesNowPlayingInfoCenter = true
        context.coordinator.attach(to: controller)
        return controller
    }

    func updateUIViewController(_ controller: AVPlayerViewController, context: Context) {
        if controller.player !== player {
            controller.player = player
        }
        context.coordinator.update(player: player, subtitleURL: subtitleURL, controller: controller)
    }

    static func dismantleUIViewController(_ controller: AVPlayerViewController, coordinator: Coordinator) {
        coordinator.teardown()
        controller.player?.pause()
        controller.player = nil
    }

    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        private var player: AVPlayer
        private var subtitleURL: URL
        private weak var controller: AVPlayerViewController?
        private let subtitleLabel = UILabel()
        private let captionButton = UIButton(type: .system)
        private var cues: [VTTCue] = []
        private var timeObserver: Any?
        private var loadTask: Task<Void, Never>?
        private var captionHideTask: Task<Void, Never>?
        private weak var playerTapRecognizer: UITapGestureRecognizer?
        private var subtitlesEnabled = true
        private var subtitleSize: SubtitleSize = .medium

        init(player: AVPlayer, subtitleURL: URL) {
            self.player = player
            self.subtitleURL = subtitleURL
        }

        func teardown() {
            loadTask?.cancel()
            captionHideTask?.cancel()
            if let timeObserver { player.removeTimeObserver(timeObserver) }
            timeObserver = nil
            if let playerTapRecognizer {
                playerTapRecognizer.view?.removeGestureRecognizer(playerTapRecognizer)
            }
        }

        func attach(to controller: AVPlayerViewController) {
            self.controller = controller
            installSubtitleLabel(in: controller)
            observePlayerTouches(in: controller)
            observePlaybackTime()
            loadSubtitles()
        }

        func update(player: AVPlayer, subtitleURL: URL, controller: AVPlayerViewController) {
            guard self.player !== player || self.subtitleURL != subtitleURL else { return }
            if let timeObserver { self.player.removeTimeObserver(timeObserver) }
            self.timeObserver = nil
            loadTask?.cancel()
            cues = []
            subtitleLabel.text = nil
            self.player = player
            self.subtitleURL = subtitleURL
            self.controller = controller
            observePlaybackTime()
            loadSubtitles()
        }

        private func installSubtitleLabel(in controller: AVPlayerViewController) {
            guard let overlay = controller.contentOverlayView else { return }
            subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
            subtitleLabel.numberOfLines = 0
            subtitleLabel.textAlignment = .center
            subtitleLabel.textColor = .white
            subtitleLabel.font = scaledSubtitleFont()
            subtitleLabel.adjustsFontForContentSizeCategory = true
            subtitleLabel.isUserInteractionEnabled = false
            subtitleLabel.layer.shadowColor = UIColor.black.cgColor
            subtitleLabel.layer.shadowOpacity = 0.95
            subtitleLabel.layer.shadowRadius = 3
            subtitleLabel.layer.shadowOffset = CGSize(width: 0, height: 1)
            overlay.addSubview(subtitleLabel)

            NSLayoutConstraint.activate([
                subtitleLabel.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
                subtitleLabel.leadingAnchor.constraint(greaterThanOrEqualTo: overlay.leadingAnchor, constant: 24),
                subtitleLabel.trailingAnchor.constraint(lessThanOrEqualTo: overlay.trailingAnchor, constant: -24),
                subtitleLabel.bottomAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.bottomAnchor, constant: -54)
            ])

            installCaptionButton(in: overlay)
        }

        private func installCaptionButton(in overlay: UIView) {
            var configuration = UIButton.Configuration.filled()
            configuration.image = UIImage(systemName: "captions.bubble.fill")
            configuration.baseForegroundColor = .white
            configuration.baseBackgroundColor = UIColor.black.withAlphaComponent(0.58)
            configuration.cornerStyle = .capsule
            configuration.contentInsets = NSDirectionalEdgeInsets(top: 9, leading: 9, bottom: 9, trailing: 9)

            captionButton.configuration = configuration
            captionButton.translatesAutoresizingMaskIntoConstraints = false
            captionButton.showsMenuAsPrimaryAction = true
            captionButton.accessibilityLabel = "Subtitles"
            captionButton.isHidden = true
            captionButton.alpha = 0
            captionButton.addTarget(self, action: #selector(keepCaptionButtonVisible), for: .touchDown)
            overlay.addSubview(captionButton)

            NSLayoutConstraint.activate([
                captionButton.trailingAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.trailingAnchor, constant: -16),
                captionButton.topAnchor.constraint(equalTo: overlay.safeAreaLayoutGuide.topAnchor, constant: 16),
                captionButton.widthAnchor.constraint(equalToConstant: 44),
                captionButton.heightAnchor.constraint(equalToConstant: 44)
            ])
            refreshCaptionMenu()
        }

        private func refreshCaptionMenu() {
            let off = UIAction(
                title: "Off",
                image: UIImage(systemName: "captions.bubble") ,
                state: subtitlesEnabled ? .off : .on
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.subtitlesEnabled = false
                    self?.subtitleLabel.text = nil
                    self?.refreshCaptionMenu()
                    self?.scheduleCaptionButtonHide()
                }
            }

            let sizes = SubtitleSize.allCases.map { size in
                UIAction(
                    title: size.title,
                    image: UIImage(systemName: size.symbol),
                    state: subtitlesEnabled && subtitleSize == size ? .on : .off
                ) { [weak self] _ in
                    Task { @MainActor in
                        guard let self else { return }
                        self.subtitleSize = size
                        self.subtitlesEnabled = true
                        self.subtitleLabel.font = self.scaledSubtitleFont()
                        self.displayCue(at: self.player.currentTime().seconds)
                        self.refreshCaptionMenu()
                        self.scheduleCaptionButtonHide()
                    }
                }
            }

            captionButton.menu = UIMenu(
                title: "Subtitles",
                children: [off, UIMenu(title: "Text Size", options: .displayInline, children: sizes)]
            )
        }

        private func scaledSubtitleFont() -> UIFont {
            UIFontMetrics(forTextStyle: .title3).scaledFont(
                for: .systemFont(ofSize: subtitleSize.rawValue, weight: .semibold)
            )
        }

        private func observePlayerTouches(in controller: AVPlayerViewController) {
            let recognizer = UITapGestureRecognizer(target: self, action: #selector(playerWasTapped))
            recognizer.cancelsTouchesInView = false
            recognizer.delegate = self
            controller.view.addGestureRecognizer(recognizer)
            playerTapRecognizer = recognizer
        }

        nonisolated func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            guard let touchedView = touch.view else { return true }
            return !touchedView.isDescendant(of: captionButton)
        }

        @objc private func playerWasTapped() {
            showCaptionButton()
        }

        @objc private func keepCaptionButtonVisible() {
            captionHideTask?.cancel()
        }

        private func showCaptionButton() {
            guard !cues.isEmpty else { return }
            captionHideTask?.cancel()
            captionButton.isHidden = false
            UIView.animate(withDuration: 0.14) {
                self.captionButton.alpha = 1
            }
            scheduleCaptionButtonHide()
        }

        private func scheduleCaptionButtonHide() {
            captionHideTask?.cancel()
            captionHideTask = Task { [weak self] in
                try? await Task.sleep(for: .seconds(1.5))
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    guard let self else { return }
                    UIView.animate(withDuration: 0.18) {
                        self.captionButton.alpha = 0
                    } completion: { _ in
                        self.captionButton.isHidden = true
                    }
                }
            }
        }

        private func observePlaybackTime() {
            timeObserver = player.addPeriodicTimeObserver(
                forInterval: CMTime(seconds: 0.15, preferredTimescale: 600),
                queue: .main
            ) { [weak self] time in
                Task { @MainActor [weak self] in
                    self?.displayCue(at: time.seconds)
                }
            }
        }

        private func loadSubtitles() {
            let requestedURL = subtitleURL
            loadTask = Task { [weak self] in
                guard let self else { return }
                do {
                    let (data, response) = try await URLSession.shared.data(from: requestedURL)
                    guard let http = response as? HTTPURLResponse,
                          (200..<300).contains(http.statusCode),
                          let text = String(data: data, encoding: .utf8) else { return }
                    let parsed = VTTParser.parse(text)
                    guard !parsed.isEmpty, !Task.isCancelled else { return }
                    await MainActor.run {
                        self.cues = parsed
                        self.subtitlesEnabled = true
                        self.refreshCaptionMenu()
                        self.showCaptionButton()
                    }
                } catch {
                    // A missing sidecar subtitle is valid; playback continues normally.
                }
            }
        }

        private func displayCue(at time: Double) {
            guard subtitlesEnabled, time.isFinite else {
                subtitleLabel.text = nil
                return
            }
            subtitleLabel.text = cues.first(where: { time >= $0.start && time < $0.end })?.text
        }

    }
}

private enum SubtitleSize: CGFloat, CaseIterable {
    case small = 18
    case medium = 23
    case large = 30

    var title: String {
        switch self {
        case .small: "Small"
        case .medium: "Medium"
        case .large: "Large"
        }
    }

    var symbol: String {
        switch self {
        case .small: "textformat.size.smaller"
        case .medium: "textformat.size"
        case .large: "textformat.size.larger"
        }
    }
}

private struct VTTCue {
    let start: Double
    let end: Double
    let text: String
}

private enum VTTParser {
    static func parse(_ source: String) -> [VTTCue] {
        let normalized = source
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        let blocks = normalized.components(separatedBy: "\n\n")

        return blocks.compactMap { block in
            let lines = block.split(separator: "\n", omittingEmptySubsequences: true).map(String.init)
            guard let timingIndex = lines.firstIndex(where: { $0.contains("-->") }) else { return nil }
            let timing = lines[timingIndex].components(separatedBy: "-->")
            guard timing.count == 2,
                  let start = timestamp(timing[0]),
                  let end = timestamp(timing[1]) else { return nil }

            let payload = lines.dropFirst(timingIndex + 1)
                .joined(separator: "\n")
                .replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !payload.isEmpty else { return nil }
            return VTTCue(start: start, end: end, text: payload)
        }
        .sorted { $0.start < $1.start }
    }

    private static func timestamp(_ raw: String) -> Double? {
        let value = raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ", maxSplits: 1)
            .first
            .map(String.init) ?? ""
        let parts = value.replacingOccurrences(of: ",", with: ".").split(separator: ":")
        guard parts.count == 2 || parts.count == 3 else { return nil }
        let seconds = Double(parts.last ?? "") ?? 0
        let minutes = Double(parts[parts.count - 2]) ?? 0
        let hours = parts.count == 3 ? (Double(parts[0]) ?? 0) : 0
        return hours * 3600 + minutes * 60 + seconds
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
